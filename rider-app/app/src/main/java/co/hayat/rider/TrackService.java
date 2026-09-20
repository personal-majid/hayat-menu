package co.hayat.rider;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

/**
 * Keeps the rider's position flowing while a delivery is live.
 *
 * A web page loses its GPS the moment Android sleeps the screen,
 * which on a bike is most of the ride. Android's answer, and the
 * only one that does not involve paying somebody, is a foreground
 * service: a visible, honest notification that says tracking is on,
 * in exchange for being allowed to keep running.
 *
 * Nothing here is hidden from the rider. The notification cannot be
 * swiped away while the service runs, and stopping it is one tap.
 */
public class TrackService extends Service implements LocationListener {

  public static final String ACTION_START = "co.hayat.rider.START";
  public static final String ACTION_STOP  = "co.hayat.rider.STOP";
  public static final String EXTRA_ORDER  = "order";

  private static final String CHANNEL = "hayat_delivery";
  private static final int    NOTE_ID = 42;

  /* the same five seconds the web app uses */
  private static final long MIN_MS     = 5000L;
  private static final float MIN_METRE = 10f;

  private LocationManager lm;
  private String orderId = "";

  /** the last fix, read by the WebView and sent on to Firestore */
  public static volatile double lastLat = 0, lastLng = 0;
  public static volatile long   lastAt  = 0;
  public static volatile boolean running = false;

  @Override public IBinder onBind(Intent i) { return null; }

  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent == null ? ACTION_START : intent.getAction();

    if (ACTION_STOP.equals(action)) {
      stopTracking();
      return START_NOT_STICKY;
    }

    if (intent != null && intent.hasExtra(EXTRA_ORDER)) {
      orderId = intent.getStringExtra(EXTRA_ORDER);
    }

    startInForeground();
    beginUpdates();
    running = true;
    /* if Android kills us for memory, come back - a delivery is
       still in progress and the shop is watching an empty map */
    return START_STICKY;
  }

  private void startInForeground() {
    NotificationManager nm =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(
          CHANNEL, "Delivery in progress", NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("Shown while your position is being shared with the shop.");
      ch.setShowBadge(false);
      nm.createNotificationChannel(ch);
    }

    Intent open = new Intent(this, MainActivity.class);
    open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent tap = PendingIntent.getActivity(this, 0, open,
        PendingIntent.FLAG_UPDATE_CURRENT |
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

    Intent stopIt = new Intent(this, TrackService.class).setAction(ACTION_STOP);
    PendingIntent stop = PendingIntent.getService(this, 1, stopIt,
        PendingIntent.FLAG_UPDATE_CURRENT |
        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

    Notification.Builder b = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        ? new Notification.Builder(this, CHANNEL)
        : new Notification.Builder(this);

    b.setContentTitle(orderId.isEmpty()
          ? "Delivery in progress"
          : "Delivering " + orderId)
     .setContentText("The shop can see where you are.")
     .setSmallIcon(android.R.drawable.ic_menu_mylocation)
     .setOngoing(true)
     .setContentIntent(tap)
     .addAction(0, "Stop sharing", stop);

    Notification note = b.build();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTE_ID, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
    } else {
      startForeground(NOTE_ID, note);
    }
  }

  private void beginUpdates() {
    lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    try {
      if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, MIN_MS, MIN_METRE, this);
      }
      if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, MIN_MS, MIN_METRE, this);
      }
    } catch (SecurityException e) {
      /* permission was refused or withdrawn: stop rather than
         pretend we are tracking */
      stopTracking();
    }
  }

  private void stopTracking() {
    running = false;
    try { if (lm != null) lm.removeUpdates(this); } catch (SecurityException ignored) {}
    stopForeground(true);
    stopSelf();
  }

  @Override public void onLocationChanged(Location l) {
    lastLat = l.getLatitude();
    lastLng = l.getLongitude();
    lastAt  = System.currentTimeMillis();
  }

  /* required on older Android */
  @Override public void onStatusChanged(String p, int s, Bundle e) {}
  @Override public void onProviderEnabled(String p) {}
  @Override public void onProviderDisabled(String p) {}

  @Override public void onDestroy() {
    running = false;
    try { if (lm != null) lm.removeUpdates(this); } catch (SecurityException ignored) {}
    super.onDestroy();
  }
}
