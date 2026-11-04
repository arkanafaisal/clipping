import path from 'path';
import { Config } from '@remotion/cli/config';
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setPublicDir(path.resolve(__dirname, 'public'));

Config.overrideBundlerConfig((currentConfiguration) => {
  return enableTailwind(currentConfiguration);
});

