HAYAT INSTAGRAM READER - FREE (Cloudflare Worker)
================================================
What it does: every day the owner page asks this Worker for your Instagram
reach, followers and each post/reel's views. The "Why we grew" page then puts
every post on the sales chart and checks whether sales moved after it.
Cost: Rs 0 (Cloudflare Workers free plan + Instagram's own free API).
The token stays inside the Worker - it is never in the app or on the website.

YOU NEED: the Hayat Instagram set to a Business or Creator account
(Instagram app -> Settings -> Account type and tools -> Switch to professional).

ONE-TIME SETUP (about 20 minutes, all in the browser)
1. developers.facebook.com -> log in with the Facebook/Instagram owner ->
   My Apps -> Create app -> "Other" -> Business -> name it  Hayat Insights.
2. In the app: Add product -> "Instagram" -> "API setup with Instagram login".
3. "Generate access tokens" -> Add account -> log in to the Hayat Instagram ->
   allow  instagram_business_basic  and  instagram_business_manage_insights.
   Copy the token it shows (long text).
4. dash.cloudflare.com -> Workers & Pages -> Create -> Worker -> name it
   hayat-insta -> Deploy -> Edit code -> paste ALL of worker.js -> Deploy.
5. Worker -> Settings -> Variables and Secrets -> Add:
     IG_TOKEN       (Secret)  the token from step 3
     ALLOW_ORIGIN   (Text)    https://personal-majid.github.io
6. Storage & Databases -> KV -> Create namespace  hayat-insta-kv
   Worker -> Settings -> Bindings -> Add -> KV namespace -> Variable name: IGKV
   (keeps the token fresh - without it the token stops after 60 days).
7. Worker -> Settings -> Triggers -> Cron Triggers -> Add:  0 3 * * 1
   (every Monday, refreshes the token; free).
8. Copy the Worker URL (https://hayat-insta.<you>.workers.dev).
9. Owner page -> Insights -> Why we grew -> Instagram -> paste the URL -> Save.

If it ever says "token expired": repeat step 3 and paste the new token in step 5.
