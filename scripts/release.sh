#!/bin/bash

while getopts "hv:" opt; do
	case ${opt} in
		h )
			usage;
			;;
		v )
			version="${OPTARG}"
			;;
		t )
			test=1
			;;
		\? )
			echo "Invalid option -${OPTARG}"
			exit 1
			;;
	esac
done
shift $((OPTIND -1))

if [ -z "$version" ]
then
  echo "-v is required"
  exit 1
fi

deno run --allow-read --allow-write --allow-run \
  https://cdn.spooky.click/spooky-release/0.0.6/cmd.js \
  --pkg beach \
  --version "$version" \
  --files **/*.md \
  --files site/pages/*.js