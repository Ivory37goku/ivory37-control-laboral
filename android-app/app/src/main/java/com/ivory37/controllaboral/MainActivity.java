package com.ivory37.controllaboral;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;

public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String LOCAL_PREFIX = "/assets/";
    private static final String LOCAL_URL = "https://" + LOCAL_HOST + LOCAL_PREFIX + "index.html";
    private static final String CHANNEL_ID = "control_laboral_reminders";
    private static final int REQUEST_PICK_FILE = 4101;
    private static final int REQUEST_SAVE_FILE = 4102;
    private static final int REQUEST_POST_NOTIFICATIONS = 4103;
    private static final int MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingSaveBytes;
    private String pendingSaveName;
    private String pendingSaveMime;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 13, 24));
        window.setNavigationBarColor(Color.rgb(7, 13, 24));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 13, 24));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(LOCAL_HOST)
                .addPathHandler(LOCAL_PREFIX, new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocalAsset(uri)) return false;
                openExternal(uri);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = callback;
                Intent intent;
                try {
                    intent = params.createIntent();
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivityForResult(intent, REQUEST_PICK_FILE);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "No hay selector de archivos disponible.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        setContentView(webView);
        createNotificationChannel();
        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) return;
        webView.loadUrl(LOCAL_URL);
    }

    private boolean isLocalAsset(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && LOCAL_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith(LOCAL_PREFIX);
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No hay navegador disponible para abrir ese enlace.", Toast.LENGTH_LONG).show();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(getString(R.string.notification_channel_description));
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private boolean notificationsEnabled() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || !manager.areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private String notificationState() {
        if (notificationsEnabled()) return "Activados";
        SharedPreferences prefs = getSharedPreferences("android_bridge", MODE_PRIVATE);
        return prefs.getBoolean("notification_requested", false) ? "Bloqueados" : "Sin activar";
    }

    private void refreshNotificationLabel() {
        if (webView == null) return;
        webView.evaluateJavascript(
                "if(window.__ivoryAndroidRefreshNotifications){window.__ivoryAndroidRefreshNotifications();}",
                null
        );
    }

    private void showNativeNotification(String title, String body) {
        if (!notificationsEnabled()) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        builder.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title == null || title.trim().isEmpty() ? getString(R.string.app_name) : title)
                .setContentText(body == null ? "" : body)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true);
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), builder.build());
    }

    private String safeFileName(String name) {
        String safe = name == null ? "archivo" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (safe.isEmpty() || safe.equals(".") || safe.equals("..")) safe = "archivo";
        return safe.length() > 120 ? safe.substring(0, 120) : safe;
    }

    private String safeMimeType(String mime) {
        if (mime == null) return "application/octet-stream";
        String type = mime.split(";", 2)[0].trim().toLowerCase();
        return type.matches("[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+") ? type : "application/octet-stream";
    }

    private void promptForSave(byte[] bytes, String fileName, String mimeType) {
        pendingSaveBytes = bytes;
        pendingSaveName = safeFileName(fileName);
        pendingSaveMime = safeMimeType(mimeType);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(pendingSaveMime);
        intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
        try {
            startActivityForResult(intent, REQUEST_SAVE_FILE);
        } catch (ActivityNotFoundException error) {
            pendingSaveBytes = null;
            Toast.makeText(this, "No se pudo abrir el selector para guardar.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_FILE) {
            if (fileChooserCallback != null) {
                Uri[] results = resultCode == RESULT_OK && data != null
                        ? WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                        : null;
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
            return;
        }
        if (requestCode == REQUEST_SAVE_FILE) {
            byte[] bytes = pendingSaveBytes;
            pendingSaveBytes = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException("No se pudo abrir el archivo");
                out.write(bytes);
                Toast.makeText(this, "Archivo guardado.", Toast.LENGTH_SHORT).show();
            } catch (Exception error) {
                Toast.makeText(this, "No se pudo guardar el archivo.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            getSharedPreferences("android_bridge", MODE_PRIVATE).edit().putBoolean("notification_requested", true).apply();
            Toast.makeText(this, notificationsEnabled() ? "Recordatorios activados." : "Permiso de notificaciones denegado.", Toast.LENGTH_LONG).show();
            refreshNotificationLabel();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            refreshNotificationLabel();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public String getNotificationState() {
            return notificationState();
        }

        @JavascriptInterface
        public void requestNotifications() {
            runOnUiThread(() -> {
                SharedPreferences prefs = getSharedPreferences("android_bridge", MODE_PRIVATE);
                prefs.edit().putBoolean("notification_requested", true).apply();
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_POST_NOTIFICATIONS);
                } else if (notificationsEnabled()) {
                    Toast.makeText(MainActivity.this, "Recordatorios activados.", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(MainActivity.this, "Activa las notificaciones de Control laboral en Ajustes de Android.", Toast.LENGTH_LONG).show();
                }
                refreshNotificationLabel();
            });
        }

        @JavascriptInterface
        public void showNotification(String title, String body) {
            runOnUiThread(() -> showNativeNotification(title, body));
        }

        @JavascriptInterface
        public void saveFile(String encoded, String fileName, String mimeType) {
            if (encoded == null || encoded.length() > (MAX_DOWNLOAD_BYTES * 4L / 3L) + 16) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "El archivo es demasiado grande.", Toast.LENGTH_LONG).show());
                return;
            }
            final byte[] bytes;
            try {
                bytes = Base64.decode(encoded, Base64.DEFAULT);
            } catch (IllegalArgumentException error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "No se pudo preparar el archivo.", Toast.LENGTH_LONG).show());
                return;
            }
            if (bytes.length > MAX_DOWNLOAD_BYTES) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "El archivo es demasiado grande.", Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> promptForSave(bytes, fileName, mimeType));
        }

        @JavascriptInterface
        public void printReport() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < 19 || webView == null) {
                    Toast.makeText(MainActivity.this, "La impresión no está disponible en este dispositivo.", Toast.LENGTH_LONG).show();
                    return;
                }
                android.print.PrintManager printManager = (android.print.PrintManager) getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) return;
                printManager.print(
                        "Control laboral",
                        webView.createPrintDocumentAdapter("Control laboral"),
                        new android.print.PrintAttributes.Builder().build()
                );
            });
        }
    }
}
