package com.local.dfamilyvsaliens;

import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * True immersive fullscreen for the game.
 *
 * - Hides system bars (status + navigation) via WindowInsetsControllerCompat.
 * - Re-enters immersive mode whenever the window regains focus (players
 *   swiping from edges may temporarily surface the system bars; we dismiss
 *   them again on next focus so the game stays fullscreen).
 * - The webview still reports the real usable area; the game's Spawn Slot
 *   hit area is kept below the top safe region (see layout), so top-edge
 *   system gestures never steal plant drags.
 */
public class MainActivity extends BridgeActivity {

    private WindowInsetsControllerCompat insetsController;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupImmersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    private void setupImmersive() {
        Window window = getWindow();
        // Draw behind system bars so the game canvas can extend to the real top edge.
        WindowCompat.setDecorFitsSystemWindows(window, false);
        insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
        enterImmersive();
    }

    private void enterImmersive() {
        if (insetsController == null) return;
        insetsController.hide(WindowInsetsCompat.Type.systemBars());
        insetsController.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
