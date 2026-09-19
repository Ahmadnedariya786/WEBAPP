package com.mehnat.tracker

import android.app.Activity
import android.app.DownloadManager
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.MediaScannerConnection
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
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
        webView.setBackgroundColor(Color.parseColor("#20242B"))
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
            // blob: URLs are handled by the JS-side nativeSave() utility which calls
            // AndroidDownloader.saveBase64() directly — nothing to do here.
            if (url.startsWith("blob:")) return@DownloadListener

            // http(s): delegate to system DownloadManager
            try {
                val request = DownloadManager.Request(Uri.parse(url))
                request.setMimeType(mimetype)
                val cookies = CookieManager.getInstance().getCookie(url)
                request.addRequestHeader("cookie", cookies)
                request.addRequestHeader("User-Agent", userAgent)
                request.setDescription("Downloading file...")
                val guessedName = URLUtil.guessFileName(url, contentDisposition, mimetype)
                request.setTitle(guessedName)
                @Suppress("DEPRECATION")
                request.allowScanningByMediaScanner()
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessedName)
                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(applicationContext, "ડાઉનલોડ શરૂ થયું...", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(applicationContext, "ડાઉનલોડ નિષ્ફળ: " + e.message, Toast.LENGTH_LONG).show()
            }
        })
    }

    /**
     * AndroidDownloader — JavascriptInterface bridge
     *
     * Called by the JS-side nativeSave() utility with a base64 data-URL.
     * Writes the file to the public Downloads folder:
     *   API 29+ → MediaStore.Downloads (scoped storage, visible in Files app immediately)
     *   API 24-28 → legacy external Downloads dir + MediaScannerConnection.scanFile()
     *                so the file appears in the Files app after scan.
     *
     * All file-IO runs on a background Thread; Toast is dispatched on the main thread.
     */
    inner class AndroidDownloader(private val context: Context) {
        private val mainHandler = Handler(Looper.getMainLooper())

        @android.webkit.JavascriptInterface
        fun saveBase64(base64Data: String, filename: String, mimeType: String) {
            Thread {
                try {
                    // Strip "data:<mime>;base64," prefix if present
                    val pureBase64 = if (base64Data.contains(",")) base64Data.substringAfter(",") else base64Data
                    val bytes = android.util.Base64.decode(pureBase64, android.util.Base64.DEFAULT)

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        // API 29+ — MediaStore scoped storage
                        val values = ContentValues().apply {
                            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                            put(MediaStore.MediaColumns.RELATIVE_PATH,
                                Environment.DIRECTORY_DOWNLOADS + "/Mehnat Tracker")
                            put(MediaStore.MediaColumns.IS_PENDING, 1)
                        }
                        val uri = context.contentResolver.insert(
                            MediaStore.Downloads.EXTERNAL_CONTENT_URI, values
                        )
                        if (uri != null) {
                            context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                            values.clear()
                            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                            context.contentResolver.update(uri, values, null, null)
                            mainHandler.post {
                                Toast.makeText(context, "ફાઇલ સેવ થઈ ✅", Toast.LENGTH_SHORT).show()
                            }
                        } else {
                            throw Exception("MediaStore insert returned null")
                        }
                    } else {
                        // API 24-28 — legacy external storage
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(
                            Environment.DIRECTORY_DOWNLOADS
                        ).also { it.mkdirs() }
                        val subDir = File(downloadsDir, "Mehnat Tracker").also { it.mkdirs() }
                        val file = File(subDir, filename)
                        file.outputStream().use { it.write(bytes) }
                        // Make the file visible in Files app
                        MediaScannerConnection.scanFile(
                            context,
                            arrayOf(file.absolutePath),
                            arrayOf(mimeType)
                        ) { _, _ -> /* scan complete */ }
                        mainHandler.post {
                            Toast.makeText(context, "ફાઇલ સેવ થઈ ✅", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    mainHandler.post {
                        Toast.makeText(context, "સેવ નિષ્ફળ ❌: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }.start()
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