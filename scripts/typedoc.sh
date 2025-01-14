# generate declaration files via typedoc

ENGINE_PATH=$(pwd)

for directory in ${ENGINE_PATH}/packages/*
do
  if [ -d $directory ]; then
    bn=`basename $directory`;
    echo "typedoc compiling $directory"
    npx $TYPEDOC --version
    npx $TYPEDOC --json api/$bn.json --tsconfig $directory/tsconfig.json $directory/src/index.ts;
    SUCCESS+=("api/$bn.json")
  fi
done

echo "============"
for f in ${SUCCESS[@]}; do
  echo "[typedoc] $f";
done
echo "============"