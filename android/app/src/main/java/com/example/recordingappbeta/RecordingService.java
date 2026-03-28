package com.example.recordingappbeta;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;

/**
 * Foreground microphone recording service.
 *
 * Records to app cache dir as MPEG_4/AAC (.m4a).
 */
public class RecordingService extends Service {
    public static final String ACTION_START = "com.example.recordingappbeta.action.START_RECORDING";
    public static final String ACTION_STOP = "com.example.recordingappbeta.action.STOP_RECORDING";
    public static final String EXTRA_OUTPUT_PATH = "outputPath";
    public static final String EXTRA_ERROR = "error";
    public static final String EXTRA_STARTED_AT_MS = "startedAtMs";
    public static final String EXTRA_STOPPED_AT_MS = "stoppedAtMs";
    public static final String BROADCAST_STOPPED = "com.example.recordingappbeta.broadcast.RECORDING_STOPPED";

    private static final String CHANNEL_ID = "recording";
    private static final int NOTIF_ID = 42;

    private MediaRecorder recorder;
    private String outputPath;
    private long startedAtMs = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) return START_NOT_STICKY;

        switch (intent.getAction()) {
            case ACTION_START:
                startRecording();
                return START_STICKY;
            case ACTION_STOP:
                stopRecordingAndBroadcast(null);
                return START_NOT_STICKY;
            default:
                return START_NOT_STICKY;
        }
    }

    private void startRecording() {
        if (recorder != null) return;

        Notification notif = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIF_ID, notif);
        }

        // Bias audio routing toward communication devices (e.g. BT headset mic).
        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (am != null) {
            am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            // Best-effort; some devices ignore this, but harmless for personal use.
            try {
                am.startBluetoothSco();
                am.setBluetoothScoOn(true);
            } catch (Exception ignored) {
            }
        }

        File out = new File(getCacheDir(), "recording-" + SystemClock.elapsedRealtime() + ".m4a");
        outputPath = out.getAbsolutePath();
        startedAtMs = System.currentTimeMillis();

        MediaRecorder mr = new MediaRecorder();
        try {
            mr.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mr.setAudioSamplingRate(44100);
            mr.setAudioEncodingBitRate(128000);
            mr.setOutputFile(outputPath);
            mr.prepare();
            mr.start();
        } catch (IOException | RuntimeException e) {
            try {
                mr.release();
            } catch (Exception ignored) {
            }
            recorder = null;
            stopRecordingAndBroadcast(e.getMessage());
            return;
        }

        recorder = mr;
    }

    private void stopRecordingAndBroadcast(@Nullable String error) {
        MediaRecorder mr = recorder;
        recorder = null;
        long stoppedAtMs = System.currentTimeMillis();

        if (mr != null) {
            try {
                mr.stop();
            } catch (RuntimeException ignored) {
                // stop can throw if recording failed early; treat as error
                if (error == null) error = "Recording failed to stop cleanly";
            }
            try {
                mr.release();
            } catch (Exception ignored) {
            }
        }

        AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
        if (am != null) {
            try {
                am.stopBluetoothSco();
                am.setBluetoothScoOn(false);
            } catch (Exception ignored) {
            }
            am.setMode(AudioManager.MODE_NORMAL);
        }

        Intent broadcast = new Intent(BROADCAST_STOPPED);
        broadcast.setPackage(getPackageName());
        broadcast.putExtra(EXTRA_OUTPUT_PATH, outputPath);
        broadcast.putExtra(EXTRA_ERROR, error);
        broadcast.putExtra(EXTRA_STARTED_AT_MS, startedAtMs);
        broadcast.putExtra(EXTRA_STOPPED_AT_MS, stoppedAtMs);
        sendBroadcast(broadcast);

        stopForeground(true);
        stopSelf();
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Recording",
                NotificationManager.IMPORTANCE_LOW
        );
        ch.setDescription("Audio recording in progress");
        nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? PendingIntent.FLAG_IMMUTABLE
                        : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Recording")
                .setContentText("Audio recording in progress")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

