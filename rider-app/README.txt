HAYAT RIDER — THE ANDROID APP
=============================

What it is
----------
A thin window onto the rider pages of the restaurant's own website.
Everything the rider sees — their jobs, the buttons, the map — comes
from the site. Publish the site and every rider has the new version
the next time they open the app. You almost never rebuild this.

How to get the APK
------------------
1. Push this folder to GitHub.
2. GitHub -> Actions -> "Build rider APK" -> Run workflow.
3. When the green tick appears, open that run and download
   "hayat-rider-apk". Inside is hayat-rider.apk.
4. Send that file to the rider on WhatsApp. On their phone:
   tap it -> "Allow from this source" -> Install.

The rider then signs in once with the phone number you registered
for them in the office (Riders page), and sees only their own jobs.

What it adds over the website
-----------------------------
  - its own icon and name, no address bar, no other tabs
  - it asks for location once, at install
  - Call, WhatsApp and Google Maps open the real apps

What it does NOT do
-------------------
It does not send the rider's position while the phone is locked.
Android pauses a WebView in the background, exactly as it pauses a
browser tab. The position updates while the delivery screen is open.

Doing better than that needs a foreground service and the delivery
screen rewritten in Kotlin — a real native app, not a wrapper. Worth
it only if you find riders are locking their phones mid-delivery.

If the site ever moves
----------------------
One line, in app/src/main/res/values/strings.xml:

    <string name="start_url">...#/drive</string>

and the host check in MainActivity.java, which keeps our own pages
inside the app and sends everything else to its proper app.
