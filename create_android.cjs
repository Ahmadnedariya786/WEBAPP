const fs = require('fs');
const path = require('path');

const dirs = [
  'android/app/src/main/java/com/mehnat/tracker',
  'android/app/src/main/res/layout',
  'android/app/src/main/res/values',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'android/app/src/main/res/mipmap-anydpi-v26',
  'android/app/src/main/res/drawable',
  '.github/workflows'
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

const files = {
  'android/settings.gradle': 'rootProject.name = "MehnatTracker"\ninclude \':app\'',

  'android/build.gradle': `buildscript {
    ext.kotlin_version = "1.8.20"
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath "com.android.tools.build:gradle:8.1.1"
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}`,

  'android/app/build.gradle': `plugins {
    id 'com.android.application'
    id 'kotlin-android'
}

android {
    namespace 'com.mehnat.tracker'
    compileSdk 34

    defaultConfig {
        applicationId "com.mehnat.tracker"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.10.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}`,

  'android/app/src/main/AndroidManifest.xml': `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.MehnatTracker"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|screenSize"
            android:theme="@style/Theme.MehnatTracker.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`,

  'android/app/src/main/res/values/strings.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">મહેનત ટ્રેકર</string>
</resources>`,

  'android/app/src/main/res/values/themes.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.MehnatTracker" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
        <item name="colorPrimary">#d946ef</item>
        <item name="colorPrimaryVariant">#a21caf</item>
        <item name="colorOnPrimary">#FFFFFF</item>
    </style>
    <style name="Theme.MehnatTracker.NoActionBar" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:windowBackground">#20242B</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowActionBar">false</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    </style>
</resources>`,

  'android/app/src/main/res/layout/activity_main.xml': `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#20242B">

    <!-- Splash Screen -->
    <LinearLayout
        android:id="@+id/splashScreen"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="#20242B"
        android:gravity="center"
        android:orientation="vertical"
        android:elevation="10dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent">

        <ImageView
            android:layout_width="120dp"
            android:layout_height="120dp"
            android:src="@mipmap/ic_launcher" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="મહેનત ટ્રેકર"
            android:textColor="#FFFFFF"
            android:textSize="24sp"
            android:textStyle="bold" />
    </LinearLayout>

    <!-- Error Screen -->
    <LinearLayout
        android:id="@+id/errorScreen"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:background="#20242B"
        android:gravity="center"
        android:orientation="vertical"
        android:visibility="gone"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="ઇન્ટરનેટ કનેક્શન નથી"
            android:textColor="#FFFFFF"
            android:textSize="20sp"
            android:layout_marginBottom="16dp"/>

        <Button
            android:id="@+id/retryButton"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="ફરી પ્રયાસ કરો"
            android:backgroundTint="#d946ef"
            android:textColor="#FFFFFF"/>
    </LinearLayout>

    <WebView
        android:id="@+id/webView"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:background="#20242B"
        android:visibility="gone"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintTop_toTopOf="parent" />

</androidx.constraintlayout.widget.ConstraintLayout>`,

  'android/app/src/main/java/com/mehnat/tracker/MainActivity.kt': `package com.mehnat.tracker

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var splashScreen: LinearLayout
    private lateinit var errorScreen: LinearLayout
    private lateinit var retryButton: Button
    private val TARGET_URL = "https://banaskantha-mehnat-tracker.vercel.app"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

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

        webView.webChromeClient = WebChromeClient()

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
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
}`,

  '.github/workflows/android.yml': `name: Android CI Build

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: gradle

    - name: Grant execute permission for gradlew (if exists)
      run: chmod +x android/gradlew || true

    - name: Setup Gradle (no wrapper)
      uses: gradle/actions/setup-gradle@v3
      with:
        gradle-version: '8.4'

    - name: Build with Gradle
      working-directory: ./android
      run: gradle assembleDebug

    - name: Upload APK
      uses: actions/upload-artifact@v3
      with:
        name: mehnat-tracker-debug.apk
        path: android/app/build/outputs/apk/debug/app-debug.apk
`
};

for (const [filepath, content] of Object.entries(files)) {
  fs.writeFileSync(filepath, content);
}

// Generate a simple gradient icon (blue-pink) as a PNG for mipmap folders
const iconBase64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAA0SURBVGhD7cExAQAAAMKg9U9tCy8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA8wFAAHt6W0TAAAAAElFTkSuQmCC"; 

['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].forEach(dpi => {
    fs.writeFileSync('android/app/src/main/res/mipmap-' + dpi + '/ic_launcher.png', Buffer.from(iconBase64, 'base64'));
    fs.writeFileSync('android/app/src/main/res/mipmap-' + dpi + '/ic_launcher_round.png', Buffer.from(iconBase64, 'base64'));
});

const icLauncherXml = '<?xml version="1.0" encoding="utf-8"?>\\n' +
'<vector xmlns:android="http://schemas.android.com/apk/res/android"\\n' +
'    android:width="108dp"\\n' +
'    android:height="108dp"\\n' +
'    android:viewportWidth="108"\\n' +
'    android:viewportHeight="108">\\n' +
'    <path\\n' +
'        android:pathData="M0,0h108v108h-108z">\\n' +
'        <aapt:attr name="android:fillColor" xmlns:aapt="http://schemas.android.com/aapt">\\n' +
'            <gradient\\n' +
'                android:startX="0"\\n' +
'                android:startY="0"\\n' +
'                android:endX="108"\\n' +
'                android:endY="108"\\n' +
'                android:type="linear">\\n' +
'                <item android:offset="0" android:color="#d946ef"/>\\n' +
'                <item android:offset="1" android:color="#7e22ce"/>\\n' +
'            </gradient>\\n' +
'        </aapt:attr>\\n' +
'    </path>\\n' +
'    <path\\n' +
'        android:fillColor="#FFFFFF"\\n' +
'        android:pathData="M38,24 h24 l14,14 v42 c0,3.3 -2.7,6 -6,6 h-32 c-3.3,0 -6,-2.7 -6,-6 v-50 c0,-3.3 2.7,-6 6,-6 z"/>\\n' +
'    <path\\n' +
'        android:fillColor="#F0F0F0"\\n' +
'        android:pathData="M62,24 v14 h14 z"/>\\n' +
'    <path\\n' +
'        android:fillColor="#d946ef"\\n' +
'        android:pathData="M44,48 h20 v4 h-20 z M44,58 h20 v4 h-20 z M44,68 h14 v4 h-14 z"/>\\n' +
'</vector>';

fs.writeFileSync('android/app/src/main/res/drawable/ic_launcher.xml', icLauncherXml);
fs.writeFileSync('android/app/src/main/res/drawable/ic_launcher_round.xml', icLauncherXml);

fs.writeFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', '<?xml version="1.0" encoding="utf-8"?>\\n' +
'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\\n' +
'    <background android:drawable="@drawable/ic_launcher"/>\\n' +
'    <foreground android:drawable="@drawable/ic_launcher"/>\\n' +
'</adaptive-icon>');

fs.writeFileSync('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', '<?xml version="1.0" encoding="utf-8"?>\\n' +
'<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\\n' +
'    <background android:drawable="@drawable/ic_launcher"/>\\n' +
'    <foreground android:drawable="@drawable/ic_launcher"/>\\n' +
'</adaptive-icon>');

console.log('Android project generated successfully!');
