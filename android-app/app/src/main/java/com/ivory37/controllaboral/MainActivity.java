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
import android.view.Gravity;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;

public final class MainActivity extends Activity {
    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String LOCAL_PREFIX = "/assets/";
    private static final String LOCAL_URL = "https://" + LOCAL_HOST + LOCAL_PREFIX + "index.html";
    private static final String HOSTED_HOST = "ivory37goku.github.io";
    private static final String HOSTED_PREFIX = "/ivory37-control-laboral/";
    private static final String HOSTED_URL = "https://" + HOSTED_HOST + HOSTED_PREFIX;
    private static final String CHANNEL_ID = "control_laboral_reminders";
    private static final String BRIDGE_PREFS = "android_bridge";
    private static final String STORAGE_SHADOW_KEY = "web_storage_shadow_v1";
    private static final int REQUEST_PICK_FILE = 4101;
    private static final int REQUEST_SAVE_FILE = 4102;
    private static final int REQUEST_POST_NOTIFICATIONS = 4103;
    private static final int MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;

    private WebView webView;
    private View loadingOverlay;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingSaveBytes;
    private String pendingSaveName;
    private String pendingSaveMime;
    private String pendingSaveRequestId;
    private boolean hostedBootstrapped;
    private boolean hostedFallbackActive;
    private boolean loadingHosted;
    private boolean showingLocalFailure;
    private boolean capturingLegacyStorage;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(7, 13, 24));
        window.setNavigationBarColor(Color.rgb(7, 13, 24));

        int background = Color.rgb(7, 13, 24);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(background);

        webView = new WebView(this);
        webView.setBackgroundColor(background);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        LinearLayout loading = new LinearLayout(this);
        loading.setOrientation(LinearLayout.VERTICAL);
        loading.setGravity(Gravity.CENTER);
        loading.setBackgroundColor(background);
        ProgressBar progress = new ProgressBar(this);
        int spinnerSize = Math.round(48 * getResources().getDisplayMetrics().density);
        loading.addView(progress, new LinearLayout.LayoutParams(spinnerSize, spinnerSize));
        TextView loadingText = new TextView(this);
        loadingText.setText("Cargando Control laboral…");
        loadingText.setTextColor(Color.WHITE);
        loadingText.setTextSize(18);
        loadingText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        textParams.topMargin = Math.round(20 * getResources().getDisplayMetrics().density);
        loading.addView(loadingText, textParams);
        root.addView(loading, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        loadingOverlay = loading;

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Internet solo se usa para la sincronización opcional con Supabase; los assets siguen siendo locales.
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
            public void onPageFinished(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if (isLocalPage(uri) && !hostedBootstrapped && !capturingLegacyStorage) {
                    captureLocalStorageAndOpenHosted(view);
                    return;
                }
                if (isHostedApp(uri)) {
                    loadingHosted = false;
                    view.clearHistory();
                } else if (isLocalPage(uri) && hostedFallbackActive) {
                    view.clearHistory();
                }
                if (loadingOverlay != null) loadingOverlay.setVisibility(View.GONE);
            }

            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (!request.isForMainFrame()) return;
                Uri uri = request.getUrl();
                if (isHostedApp(uri)) {
                    android.util.Log.w("ControlLaboral", "No se pudo cargar la app web; se abre la copia local.");
                    fallbackToBundledApp(view);
                } else {
                    android.util.Log.e("ControlLaboral", "No se pudieron cargar los archivos locales: " + error.getDescription());
                    fallbackToBundledApp(view);
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                if (request.isForMainFrame() && isHostedApp(request.getUrl()) && errorResponse.getStatusCode() >= 400) {
                    fallbackToBundledApp(view);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isLocalAsset(uri) || isHostedApp(uri)) return false;
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
        setContentView(root);
        createNotificationChannel();
        hostedBootstrapped = getSharedPreferences(BRIDGE_PREFS, MODE_PRIVATE).getBoolean("hosted_bootstrapped", false);
        if (hostedBootstrapped) {
            loadingHosted = true;
            webView.loadUrl(HOSTED_URL);
        } else {
            webView.loadUrl(LOCAL_URL);
        }
    }

    private boolean isLocalAsset(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && LOCAL_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith(LOCAL_PREFIX);
    }

    private boolean isLocalPage(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && LOCAL_HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPath() == null || uri.getPath().equals(LOCAL_PREFIX) || uri.getPath().equals(LOCAL_PREFIX + "index.html"));
    }

    private boolean isHostedApp(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
                && HOSTED_HOST.equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith(HOSTED_PREFIX);
    }

    private void beginHostedApp(WebView view) {
        hostedBootstrapped = true;
        hostedFallbackActive = false;
        loadingHosted = true;
        getSharedPreferences(BRIDGE_PREFS, MODE_PRIVATE).edit().putBoolean("hosted_bootstrapped", true).apply();
        view.loadUrl(HOSTED_URL);
    }

    private void fallbackToBundledApp(WebView view) {
        if (!hostedFallbackActive) {
            hostedFallbackActive = true;
            loadingHosted = false;
            showingLocalFailure = false;
            view.loadUrl(LOCAL_URL + "?nativeRestore=1");
            return;
        }
        if (showingLocalFailure) return;
        showingLocalFailure = true;
        String errorPage = "<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Error de carga</title>"
                + "<body style='margin:0;background:#070d18;color:#f4f7fb;font:16px sans-serif;padding:32px'><h1>No se pudo abrir Control laboral</h1>"
                + "<p>No se pudo cargar la app publicada ni los archivos locales. Tus datos guardados se conservan.</p>"
                + "<button onclick='location.reload()' style='padding:12px 18px;border:0;border-radius:10px;background:#39ff14;font-weight:bold'>Reintentar</button></body></html>";
        view.loadDataWithBaseURL("https://" + LOCAL_HOST + "/", errorPage, "text/html", "UTF-8", null);
    }

    private void captureLocalStorageAndOpenHosted(WebView view) {
        capturingLegacyStorage = true;
        String captureScript = "(function(){try{var s={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k)s[k]=localStorage.getItem(k)}AndroidBridge.saveLocalStorage(JSON.stringify(s));return true}catch(e){return false}})()";
        view.evaluateJavascript(captureScript, result -> {
            capturingLegacyStorage = false;
            beginHostedApp(view);
        });
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

    private void promptForSave(byte[] bytes, String fileName, String mimeType, String requestId) {
        pendingSaveBytes = bytes;
        pendingSaveName = safeFileName(fileName);
        pendingSaveMime = safeMimeType(mimeType);
        pendingSaveRequestId = requestId;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(pendingSaveMime);
        intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
        try {
            startActivityForResult(intent, REQUEST_SAVE_FILE);
        } catch (ActivityNotFoundException error) {
            pendingSaveBytes = null;
            notifySaveResult(false);
            Toast.makeText(this, "No se pudo abrir el selector para guardar.", Toast.LENGTH_LONG).show();
        }
    }

    private void notifySaveResult(boolean saved) {
        final String requestId = pendingSaveRequestId;
        pendingSaveRequestId = null;
        if (requestId == null || webView == null) return;
        String safeId = requestId.replaceAll("[^0-9]", "");
        String script = "if(window.__ivory37NativeSaveResult){window.__ivory37NativeSaveResult('" + safeId + "'," + (saved ? "true" : "false") + ");}";
        webView.post(() -> webView.evaluateJavascript(script, null));
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
            if (resultCode != RESULT_OK || data == null || data.getData() == null || bytes == null) {
                notifySaveResult(false);
                return;
            }
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException("No se pudo abrir el archivo");
                out.write(bytes);
                notifySaveResult(true);
                Toast.makeText(this, "Archivo guardado.", Toast.LENGTH_SHORT).show();
            } catch (Exception error) {
                notifySaveResult(false);
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
        public void saveFile(String encoded, String fileName, String mimeType, String requestId) {
            if (encoded == null || encoded.length() > (MAX_DOWNLOAD_BYTES * 4L / 3L) + 16) {
                pendingSaveRequestId = requestId;
                notifySaveResult(false);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "El archivo es demasiado grande.", Toast.LENGTH_LONG).show());
                return;
            }
            final byte[] bytes;
            try {
                bytes = Base64.decode(encoded, Base64.DEFAULT);
            } catch (IllegalArgumentException error) {
                pendingSaveRequestId = requestId;
                notifySaveResult(false);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "No se pudo preparar el archivo.", Toast.LENGTH_LONG).show());
                return;
            }
            if (bytes.length > MAX_DOWNLOAD_BYTES) {
                pendingSaveRequestId = requestId;
                notifySaveResult(false);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "El archivo es demasiado grande.", Toast.LENGTH_LONG).show());
                return;
            }
            runOnUiThread(() -> promptForSave(bytes, fileName, mimeType, requestId));
        }

        @JavascriptInterface
        public String getLocalStorageSnapshot() {
            return getSharedPreferences(BRIDGE_PREFS, MODE_PRIVATE).getString(STORAGE_SHADOW_KEY, "{}");
        }

        @JavascriptInterface
        public boolean saveLocalStorage(String snapshot) {
            if (snapshot == null || snapshot.length() > MAX_DOWNLOAD_BYTES) return false;
            try {
                new org.json.JSONObject(snapshot);
                return getSharedPreferences(BRIDGE_PREFS, MODE_PRIVATE)
                        .edit().putString(STORAGE_SHADOW_KEY, snapshot).commit();
            } catch (Exception error) {
                return false;
            }
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
