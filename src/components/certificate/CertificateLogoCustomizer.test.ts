import test from 'node:test';
import assert from 'node:assert/strict';
import type { CertificateLogoSettings } from '../../types';

test('CertificateLogoSettings supports print calibration and custom URLs', () => {
  const settings: CertificateLogoSettings = {
    leftLogoType: 'custom',
    leftLogoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    leftBarangayName: 'NAVA',
    centerLogoType: 'custom',
    centerLogoUrl: 'https://example.com/center.png',
    rightLogoType: 'bagong_pilipinas',
    showWatermark: true,
    watermarkType: 'custom',
    watermarkUrl: 'https://example.com/watermark.png',
    watermarkOpacity: 0.12,
    printLogoSize: 84,
    printShowWatermark: true,
    printWatermarkOpacity: 0.1,
    printGrayscale: true,
    printHideCenterLogo: false,
  };

  assert.equal(settings.leftLogoType, 'custom');
  assert.ok(settings.leftLogoUrl?.startsWith('data:image/png;base64'));
  assert.equal(settings.centerLogoType, 'custom');
  assert.equal(settings.centerLogoUrl, 'https://example.com/center.png');
  assert.equal(settings.watermarkType, 'custom');
  assert.equal(settings.printLogoSize, 84);
  assert.equal(settings.printGrayscale, true);
  assert.equal(settings.printHideCenterLogo, false);
});
