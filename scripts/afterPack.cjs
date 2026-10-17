const path = require("node:path");
const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");

exports.default = async function afterPack(context) {
  const executable = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  await flipFuses(executable, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // Kept enabled so automated UI smoke tests can drive the packaged app.
    [FuseV1Options.EnableNodeCliInspectArguments]: true,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // Kept enabled (Electron default): the renderer loads via file:// from the
    // asar, and disabling this fuse makes file:// asar reads fail with
    // ERR_FILE_NOT_FOUND. Revisit only alongside a custom app:// protocol.
  });
};
