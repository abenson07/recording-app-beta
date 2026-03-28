package com.example.recordingappbeta;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Base64;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(name = "Recording")
public class RecordingPlugin extends Plugin {
  private static final String DEFAULT_MIME = "audio/mp4";

  @PluginMethod
  public void start(PluginCall call) {
    Context ctx = getContext();
    Intent i = new Intent(ctx, RecordingService.class);
    i.setAction(RecordingService.ACTION_START);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ctx.startForegroundService(i);
    } else {
      ctx.startService(i);
    }

    JSObject ret = new JSObject();
    ret.put("ok", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void stop(PluginCall call) {
    Context ctx = getContext();
    Intent i = new Intent(ctx, RecordingService.class);
    i.setAction(RecordingService.ACTION_STOP);
    ctx.startService(i);

    @Nullable File out = RecordingService.consumeLastOutputFile();
    if (out == null || !out.exists()) {
      call.reject("No recording output found. If you stopped immediately, try again.");
      return;
    }

    try {
      byte[] bytes = readAllBytes(out);
      String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("base64", b64);
      ret.put("mimeType", DEFAULT_MIME);
      ret.put("bytes", bytes.length);
      call.resolve(ret);
    } catch (IOException e) {
      call.reject("Failed to read recording: " + e.getMessage());
    } finally {
      // Best-effort cleanup; persist happens in JS after upload.
      //noinspection ResultOfMethodCallIgnored
      out.delete();
    }
  }

  private static byte[] readAllBytes(File f) throws IOException {
    int len = (int) f.length();
    byte[] buf = new byte[len];
    FileInputStream in = new FileInputStream(f);
    try {
      int off = 0;
      while (off < len) {
        int r = in.read(buf, off, len - off);
        if (r < 0) break;
        off += r;
      }
      if (off != len) {
        throw new IOException("Short read (" + off + "/" + len + ")");
      }
      return buf;
    } finally {
      in.close();
    }
  }
}

