# AI Fight Arena Online
Server-authoritative 2D fighting game. Node + Socket.IO + Canvas.

## Run locally
    npm install
    npm start        # http://localhost:3000
Same Wi-Fi test: open http://<laptop-ip>:3000 on the phone.

## Deploy free (Render)
1. Upload this folder to a new GitHub repo.
2. render.com > New > Web Service > pick the repo (render.yaml is auto-detected, Free plan).
3. Open the https URL it gives you. Create Room on laptop, Join with the 4-letter code on phone.
(Free tier sleeps after idle; first load can take ~50s.)

## Controls
Desktop: A/D or arrows move, W/Up jump, S/Down crouch, F/K punch, G/L kick. Touch buttons appear on phones.
Rules: punch 8 dmg (misses crouching foes), kick 13 dmg, best of 3, 60s rounds. Disconnected match pauses; rejoin with same code in same browser.
