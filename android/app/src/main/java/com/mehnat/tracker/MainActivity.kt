package com.mehnat.tracker

import android.app.Activity
import android.app.DownloadManager
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashScreen: LinearLayout
    private lateinit var errorScreen: LinearLayout
    private lateinit var retryButton: Button
    private val TARGET_URL = "https://banaskantha-mehnat-tracker.vercel.app"

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null

    companion object {
        private const val FILE_CHOOSER_REQUEST_CODE = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        if (savedInstanceState != null) {
            @Suppress("DEPRECATION")
            cameraImageUri = savedInstanceState.getParcelable("camera_image_uri")
        }

        webView = findViewById(R.id.webView)
        splashScreen = findViewById(R.id.splashScreen)
        errorScreen = findViewById(R.id.errorScreen)
        retryButton = findViewById(R.id.retryButton)

        setupWebView()

        retryButton.setOnClickListener {
            checkInternetAndLoad()
        }

        // Show splash for 2 seconds then check internet
        Handler(Looper.getMainLooper()).postDelayed({
            splashScreen.visibility = View.GONE
            checkInternetAndLoad()
        }, 2000)
    }

    private fun setupWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.allowFileAccess = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url.toString()
                if (url.startsWith("https://wa.me") || url.startsWith("mailto:") || url.startsWith("tel:")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "એપ ઉપલબ્ધ નથી", Toast.LENGTH_SHORT).show()
                    }
                    return true
                }
                return super.shouldOverrideUrlLoading(view, request)
            }
        }

        webView.addJavascriptInterface(AndroidDownloader(this), "AndroidDownloader")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // Ensure any previous unresolved callback is cleared cleanly
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val isCapture = fileChooserParams?.isCaptureEnabled == true

                if (isCapture) {
                    val photoFile = try {
                        val storageDir = File(cacheDir, "camera_photos").apply { if (!exists()) mkdirs() }
                        File.createTempFile("IMG_${System.currentTimeMillis()}_", ".jpg", storageDir)
                    } catch (e: Exception) {
                        null
                    }

                    if (photoFile == null) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        return false
                    }

                    val photoUri = try {
                        FileProvider.getUriForFile(
                            this@MainActivity,
                            "${applicationContext.packageName}.fileprovider",
                            photoFile
                        )
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        return false
                    }

                    cameraImageUri = photoUri
                    getSharedPreferences("camera_prefs", Context.MODE_PRIVATE)
                        .edit()
                        .putString("saved_camera_uri", photoUri.toString())
                        .apply()

                    val captureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                        putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        clipData = ClipData.newRawUri("", photoUri)
                    }

                    try {
                        startActivityForResult(captureIntent, FILE_CHOOSER_REQUEST_CODE)
                        return true
                    } catch (e: Exception) {
                        cameraImageUri = null
                        getSharedPreferences("camera_prefs", Context.MODE_PRIVATE)
                            .edit()
                            .remove("saved_camera_uri")
                            .apply()
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        return false
                    }
                } else {
                    cameraImageUri = null
                    getSharedPreferences("camera_prefs", Context.MODE_PRIVATE)
                        .edit()
                        .remove("saved_camera_uri")
                        .apply()
                    val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                        if (fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                        }
                    }

                    try {
                        startActivityForResult(contentIntent, FILE_CHOOSER_REQUEST_CODE)
                        return true
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        return false
                    }
                }
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            if (url.startsWith("blob:")) {
                val js = """
                    (function() {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', '$url', true);
                        xhr.responseType = 'blob';
                        xhr.onload = function(e) {
                            if (this.status == 200) {
                                var blob = this.response;
                                var reader = new FileReader();
                                reader.readAsDataURL(blob);
                                reader.onloadend = function() {
                                    var base64data = reader.result;
                                    var filename = window.AndroidPreparedFilename || 'download';
                                    var mime = window.AndroidPreparedMime || '$mimetype';
                                    window.AndroidDownloader.saveBase64(base64data, filename, mime);
                                }
                            }
                        };
                        xhr.send();
                    })();
                """.trimIndent()
                webView.evaluateJavascript(js, null)
                return@DownloadListener
            }

            try {
                val request = DownloadManager.Request(Uri.parse(url))
                request.setMimeType(mimetype)
                val cookies = CookieManager.getInstance().getCookie(url)
                request.addRequestHeader("cookie", cookies)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription("Downloading file...")
                request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype))
                request.allowScanningByMediaScanner()
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimetype))
                
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(applicationContext, "ડાઉનલોડ શરૂ થયું...", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(applicationContext, "ડાઉનલોડ નિષ્ફળ: " + e.message, Toast.LENGTH_LONG).show()
            }
        })
    }

    inner class AndroidDownloader(private val context: Context) {
        @android.webkit.JavascriptInterface
        fun saveBase64(base64Data: String, filename: String, mimeType: String) {
            try {
                val pureBase64 = if (base64Data.contains(",")) base64Data.split(",")[1] else base64Data
                val bytes = android.util.Base64.decode(pureBase64, android.util.Base64.DEFAULT)
                
                val values = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }

                val uri = context.contentResolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    context.contentResolver.openOutputStream(uri)?.use {
                        it.write(bytes)
                    }
                    Handler(Looper.getMainLooper()).post {
                        Toast.makeText(context, "ડાઉનલોડ સફળ ✅", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val file = java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), filename)
                    java.io.FileOutputStream(file).use {
                        it.write(bytes)
                    }
                    Handler(Looper.getMainLooper()).post {
                        Toast.makeText(context, "ડાઉનલોડ સફળ ✅", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(context, "ડાઉનલોડ નિષ્ફળ ❌", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun checkInternetAndLoad() {
        if (isNetworkAvailable()) {
            errorScreen.visibility = View.GONE
            webView.visibility = View.VISIBLE
            webView.loadUrl(TARGET_URL)
        } else {
            webView.visibility = View.GONE
            errorScreen.visibility = View.VISIBLE
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onBackPressed() {
        if (webView.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            val callback = filePathCallback
            if (callback == null) {
                super.onActivityResult(requestCode, resultCode, data)
                return
            }

            if (resultCode == Activity.RESULT_OK) {
                val clipDataUri = if (data?.clipData != null && data.clipData!!.itemCount > 0) {
                    data.clipData!!.getItemAt(0).uri
                } else null

                val prefs = getSharedPreferences("camera_prefs", Context.MODE_PRIVATE)
                val savedUriStr = prefs.getString("saved_camera_uri", null)
                val savedCameraUri = cameraImageUri ?: (if (savedUriStr != null) Uri.parse(savedUriStr) else null)

                val uri = data?.data ?: clipDataUri ?: savedCameraUri
                val results: Array<Uri>? = if (uri != null) arrayOf(uri) else null
                callback.onReceiveValue(results)
            } else {
                callback.onReceiveValue(null)
            }

            filePathCallback = null
            cameraImageUri = null
            getSharedPreferences("camera_prefs", Context.MODE_PRIVATE)
                .edit()
                .remove("saved_camera_uri")
                .apply()
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        cameraImageUri?.let { outState.putParcelable("camera_image_uri", it) }
    }
}