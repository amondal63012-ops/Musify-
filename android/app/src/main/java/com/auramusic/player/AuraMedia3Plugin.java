package com.auramusic.player;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@UnstableApi
@CapacitorPlugin(name = "AuraMedia3")
public class AuraMedia3Plugin extends Plugin implements AuraMediaPlaybackService.TransportListener {

    private ListenableFuture<MediaController> controllerFuture;
    private MediaController mediaController;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService httpExecutor = Executors.newCachedThreadPool();

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (mediaController != null && mediaController.isPlaying()) {
                emitProgress();
                mainHandler.postDelayed(this, 500);
            }
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            emitState();
            mainHandler.removeCallbacks(progressRunnable);
            if (isPlaying) {
                mainHandler.post(progressRunnable);
            }
        }

        @Override
        public void onPlaybackStateChanged(int playbackState) {
            emitState();
            if (playbackState == Player.STATE_ENDED) {
                mainHandler.removeCallbacks(progressRunnable);
                notifyListeners("playbackEnded", new JSObject());
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            mainHandler.removeCallbacks(progressRunnable);
            JSObject data = new JSObject();
            data.put("message", error.getMessage() != null ? error.getMessage() : "Native Media3 playback error");
            notifyListeners("playbackError", data);
        }
    };

    @Override
    public void load() {
        AuraMediaPlaybackService.setTransportListener(this);
        SessionToken sessionToken = new SessionToken(
            getContext(),
            new ComponentName(getContext(), AuraMediaPlaybackService.class)
        );
        controllerFuture = new MediaController.Builder(getContext(), sessionToken).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                mediaController = controllerFuture.get();
                mediaController.addListener(playerListener);
            } catch (ExecutionException | InterruptedException ignored) {
                // Controller connection will retry on next playback command
            }
        }, mainHandler::post);
    }

    @Override
    public void onNextRequested() {
        mainHandler.post(() -> notifyListeners("playbackNext", new JSObject()));
    }

    @Override
    public void onPreviousRequested() {
        mainHandler.post(() -> notifyListeners("playbackPrev", new JSObject()));
    }

    private void withController(ControllerTask task, PluginCall call) {
        mainHandler.post(() -> {
            if (mediaController != null) {
                task.run(mediaController);
                return;
            }
            if (controllerFuture == null) {
                load();
            }
            if (controllerFuture != null) {
                controllerFuture.addListener(() -> {
                    try {
                        mediaController = controllerFuture.get();
                        mediaController.removeListener(playerListener);
                        mediaController.addListener(playerListener);
                        task.run(mediaController);
                    } catch (Exception e) {
                        if (call != null) {
                            call.reject("Unable to connect to Media3 playback service", e);
                        }
                    }
                }, mainHandler::post);
            } else if (call != null) {
                call.reject("Media3 controller uninitialized");
            }
        });
    }

    @PluginMethod
    public void playTrack(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Track stream URL is required");
            return;
        }
        String title = call.getString("title", "Unknown Track");
        String artist = call.getString("artist", "Unknown Artist");
        String album = call.getString("album", "Aura Music");
        String coverUrl = call.getString("coverUrl", "");
        Boolean isHlsFlag = call.getBoolean("isHls", false);
        boolean isHls = Boolean.TRUE.equals(isHlsFlag) || url.contains(".m3u8") || url.contains("proto=hls");

        withController(controller -> {
            MediaMetadata.Builder metaBuilder = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setAlbumTitle(album);

            if (coverUrl != null && !coverUrl.trim().isEmpty() && (coverUrl.startsWith("http://") || coverUrl.startsWith("https://"))) {
                metaBuilder.setArtworkUri(Uri.parse(coverUrl));
            }

            MediaItem.Builder itemBuilder = new MediaItem.Builder()
                .setUri(Uri.parse(url))
                .setMediaMetadata(metaBuilder.build());

            if (isHls) {
                itemBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
            }

            controller.setMediaItem(itemBuilder.build());
            controller.prepare();
            controller.play();
            emitState();
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(controller -> {
            controller.pause();
            emitState();
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withController(controller -> {
            controller.play();
            emitState();
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double positionSec = call.getDouble("positionSec", 0.0);
        long positionMs = Math.max(0L, Math.round((positionSec != null ? positionSec : 0.0) * 1000.0));
        withController(controller -> {
            controller.seekTo(positionMs);
            emitProgress();
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume", 1.0);
        float clamped = (float) Math.max(0.0, Math.min(1.0, volume != null ? volume : 1.0));
        withController(controller -> {
            controller.setVolume(clamped);
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        withController(controller -> {
            mainHandler.removeCallbacks(progressRunnable);
            controller.stop();
            controller.clearMediaItems();
            emitState();
            call.resolve();
        }, call);
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        withController(controller -> {
            call.resolve(buildStatePayload(controller));
        }, call);
    }

    private JSObject buildStatePayload(MediaController controller) {
        long durMs = Math.max(0L, controller.getDuration());
        long posMs = Math.max(0L, controller.getCurrentPosition());
        JSObject data = new JSObject();
        data.put("isPlaying", controller.isPlaying());
        data.put("isBuffering", controller.getPlaybackState() == Player.STATE_BUFFERING);
        data.put("durationSec", durMs > 0 && durMs < 86400000L ? durMs / 1000.0 : 0.0);
        data.put("positionSec", posMs / 1000.0);
        return data;
    }

    private void emitState() {
        if (mediaController == null) return;
        notifyListeners("playbackState", buildStatePayload(mediaController));
    }

    private void emitProgress() {
        if (mediaController == null) return;
        long durMs = Math.max(0L, mediaController.getDuration());
        long posMs = Math.max(0L, mediaController.getCurrentPosition());
        JSObject data = new JSObject();
        data.put("positionSec", posMs / 1000.0);
        data.put("durationSec", durMs > 0 && durMs < 86400000L ? durMs / 1000.0 : 0.0);
        notifyListeners("playbackProgress", data);
    }

    @PluginMethod
    public void httpRequest(PluginCall call) {
        String urlStr = call.getString("url");
        if (urlStr == null || !(urlStr.startsWith("https://") || urlStr.startsWith("http://"))) {
            call.reject("Valid http/https url is required");
            return;
        }
        String method = call.getString("method", "GET");
        JSObject headersObj = call.getObject("headers");
        String requestBody = call.getString("body", null);
        Integer timeoutObj = call.getInt("timeoutMs", 8000);
        int timeoutMs = timeoutObj != null ? Math.max(2000, Math.min(20000, timeoutObj)) : 8000;

        httpExecutor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                String currentUrl = urlStr;
                int status = 0;
                for (int hop = 0; hop < 5; hop++) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(timeoutMs);
                    conn.setReadTimeout(timeoutMs);
                    conn.setRequestMethod(hop == 0 && method != null ? method.toUpperCase() : "GET");
                    conn.setRequestProperty("Accept", "*/*");
                    if (headersObj != null) {
                        Iterator<String> keys = headersObj.keys();
                        while (keys.hasNext()) {
                            String k = keys.next();
                            String v = headersObj.optString(k, null);
                            if (v != null && !v.isEmpty()) {
                                conn.setRequestProperty(k, v);
                            }
                        }
                    }
                    if (hop == 0 && requestBody != null && "POST".equalsIgnoreCase(method)) {
                        conn.setDoOutput(true);
                        byte[] bytes = requestBody.getBytes(StandardCharsets.UTF_8);
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(bytes);
                        }
                    }
                    status = conn.getResponseCode();
                    if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        conn = null;
                        if (loc == null || loc.isEmpty()) {
                            break;
                        }
                        currentUrl = new URL(url, loc).toString();
                        continue;
                    }
                    break;
                }

                StringBuilder sb = new StringBuilder();
                if (conn != null) {
                    InputStream is = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
                    if (is != null) {
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                sb.append(line).append('\n');
                            }
                        }
                    }
                }

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", sb.toString());
                result.put("finalUrl", currentUrl);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("HTTP request failed: " + (e.getMessage() != null ? e.getMessage() : "unknown error"), e);
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(progressRunnable);
        httpExecutor.shutdownNow();
        AuraMediaPlaybackService.setTransportListener(null);
        if (mediaController != null) {
            mediaController.removeListener(playerListener);
            mediaController = null;
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        super.handleOnDestroy();
    }

    private interface ControllerTask {
        void run(MediaController controller);
    }
}
