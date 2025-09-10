⸻

Installation Guide

This package adds a Craps category to the Node-RED palette, allowing you to design strategies visually and export them into CrapsSim strategies.

⸻

Prerequisites
	•	Node.js ≥ 18
	•	Node-RED ≥ 3.0
	•	(Optional) Docker if you prefer containerized Node-RED
	•	CrapsSim (pip install crapssim) to run exported strategies

⸻

Installation

Option 1: Install via npm (recommended)
	1.	Open a terminal / command prompt.
	2.	Navigate to your Node-RED user directory:
	•	Linux/macOS:

cd ~/.node-red


	•	Windows (PowerShell or CMD):

cd %HOMEPATH%\.node-red


	3.	Install the package:

npm install nova-rey/crapssim-compiler


	4.	Restart Node-RED:
	•	Linux/macOS:

node-red-stop && node-red-start


	•	Windows: Close Node-RED and relaunch it from the Start Menu or PowerShell.
	•	Docker:

docker restart mynodered



When Node-RED restarts, open the editor in your browser (http://localhost:1880/) and check for a Craps category in the palette.

⸻

Option 2: Local development install

If you’ve cloned this repo locally:

cd ~/.node-red
npm install /path/to/node-red-contrib-craps

Restart Node-RED, and the nodes will appear in your palette.

⸻

Quick Test
	1.	Import the sample flow from examples/ (Iron Cross).
	2.	Add a validator and export node.
	3.	Run the export — a .py file is created.
	4.	Execute with CrapsSim:

pip install crapssim
python3 ironcross.py



⸻

Troubleshooting
	•	If the Craps category doesn’t appear after install, double-check that you ran npm install inside your Node-RED user directory (~/.node-red or %HOMEPATH%\.node-red).
	•	Run npm ls inside ~/.node-red to confirm the package is installed.
	•	If running under Docker, make sure the /data volume is persistent and you restarted the container.

⸻
