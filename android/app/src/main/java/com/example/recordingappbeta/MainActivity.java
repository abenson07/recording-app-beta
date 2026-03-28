package com.example.recordingappbeta;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    Bridge bridge = this.getBridge();
    if (bridge != null) {
      bridge.registerPlugin(RecordingPlugin.class);
    }
  }
}
