package com.trendit.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativePushPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
