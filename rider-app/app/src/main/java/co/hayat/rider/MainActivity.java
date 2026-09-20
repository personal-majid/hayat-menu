package co.hayat.rider;

/*  Hayat Rider
 *  ---------------------------------------------------------------
 *  A window onto the rider pages of the restaurant's own site. The
 *  delivery logic lives there and is updated by publishing the site,
 *  so this app almost never needs a new build.
 *
 *  What it adds over a browser tab:
 *    - its own icon, no address bar, no other tabs to get lost in
 *    - it asks for location once, at install, the way riders expect
 *    - tel: and WhatsApp links leave for the real apps
 *
 *  What it does NOT do: track the rider with the screen locked. A
 *  WebView is paused when Android backgrounds it, the same as a
 *  browser. Continuous background tracking needs a foreground
 *  service and a rewrite of the delivery screen in Kotlin.
 *  --------------------------------------------------------------- */

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends AppCompatActivity {

  private WebView web;

  @SuppressLint("SetJavaScriptEnabled")
  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);

    askForLocation();

    /* A sleeping screen is a stopped GPS, in a WebView exactly as in a
       browser. Holding the screen on is the honest fix for a wrapper. */
    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

    web = new WebView(this);
    setContentView(web);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);          // the rider's sign-in lives here
    s.setGeolocationEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);

    /* The site's own pages stay inside the app. Anything else — a
       phone call, WhatsApp, Google Maps — belongs to its own app. */
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
        Uri u = req.getUrl();
        String host = u.getHost() == null ? "" : u.getHost();
        if (host.equals("personal-majid.github.io")) return false;
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignored) { }
        return true;
      }
    });

    /* A WebView refuses location until the app says yes on its behalf. */
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(
          String origin, GeolocationPermissions.Callback cb) {
        cb.invoke(origin, true, true);
      }
    });

    web.loadUrl(getString(R.string.start_url));
  }

  /*  Android splits this in two on purpose, and will refuse the second
   *  ask if both arrive together: first "while using the app", then,
   *  separately, "all the time". Riders should say yes to both, or the
   *  customer's map freezes the moment they look at WhatsApp.          */
  private void askForLocation() {
    boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                   == PackageManager.PERMISSION_GRANTED;
    if (!fine) {
      ActivityCompat.requestPermissions(this, new String[]{
          Manifest.permission.ACCESS_FINE_LOCATION,
          Manifest.permission.ACCESS_COARSE_LOCATION }, 1);
      return;                       // the second ask waits for this answer
    }
    askForAlways();
  }

  private void askForAlways() {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return;
    boolean bg = ContextCompat.checkSelfPermission(this,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    if (!bg) {
      ActivityCompat.requestPermissions(this, new String[]{
          Manifest.permission.ACCESS_BACKGROUND_LOCATION }, 2);
    }
  }

  @Override public void onRequestPermissionsResult(
      int code, String[] perms, int[] results) {
    super.onRequestPermissionsResult(code, perms, results);
    if (code == 1 && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
      askForAlways();
    }
  }

  /* Back walks the rider's own history before it closes the app. */
  @Override public boolean onKeyDown(int code, KeyEvent e) {
    if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
      web.goBack();
      return true;
    }
    return super.onKeyDown(code, e);
  }
}
