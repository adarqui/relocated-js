Watches directories based on 'glob' syntax. New files get monitored. Once they have 'stopped uploading', we fire off some scripts to relocate the file (upload it to the cloud, who knows). Once that is completed, we also send a resque job so that everything can be processd. Check ./example/ for the check & relocate scripts examples.

quick example howto:

		node relocated.js

Then:

		./example/runme


This will continually create a bunch of files and relocated will move them around.

To quit the example:

		pkill -9 -f runme

gn
