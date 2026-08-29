import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import './style.css';

// FIT scale: the whole 1920×1080 logical canvas is always fully visible.
// Non-16:9 devices get letterbox bars instead of cropping; nothing is ever cut.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1920,
  height: 1080,
  backgroundColor: '#111923',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
  },
});
