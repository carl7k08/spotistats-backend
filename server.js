import "dotenv/config";
import express from "express";
import cors from "cors";
import SpotifyWebApi from "spotify-web-api-node";

const app = express();
app.use(cors());
app.use(express.json());

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

app.get("/login", (_req, res) => {
  const scopes = ["user-top-read", "user-read-recently-played", "user-modify-playback-state"];
  res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get("/callback", async (req, res) => {
  try {
    const { body } = await spotifyApi.authorizationCodeGrant(req.query.code);
    spotifyApi.setAccessToken(body.access_token);
    res.redirect(`https://carl7k08.github.io/spotistats-preview/stats.html#${body.access_token}`);
  } catch (e) {
    console.error("❌ /callback", e);
    res.status(500).send("Auth failed");
  }
});

function useToken(req, res) {
  const t = req.headers.authorization?.split(" ")[1];
  if (!t) return res.status(401).json({ error: "No token" }), null;
  spotifyApi.setAccessToken(t);
  return t;
}

app.get("/top", async (req, res) => {
  if (!useToken(req, res)) return;
  const { body } = await spotifyApi.getMyTopTracks({ limit: 10 });
  res.json(body);
});

app.get("/top-artists", async (req, res) => {
  if (!useToken(req, res)) return;
  const { body } = await spotifyApi.getMyTopArtists({ limit: 10 });
  res.json(body);
});

app.get("/recently-played", async (req, res) => {
  if (!useToken(req, res)) return;
  const { body } = await spotifyApi.getMyRecentlyPlayedTracks({ limit: 10 });
  res.json(body);
});

app.put("/play", async (req, res) => {
  if (!useToken(req, res)) return;
  await spotifyApi.play(req.body);
  res.sendStatus(204);
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));