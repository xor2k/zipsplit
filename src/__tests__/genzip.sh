rm -f zip.zip zip64.zip
zip -0 zip.zip data/*
zip -0 -fz- zip64.zip data/*