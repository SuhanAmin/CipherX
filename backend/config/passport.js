const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 🔥 extract data safely
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || "User";

        if (!email) {
          return done(new Error("No email found from Google"), null);
        }

        // 🔥 check by googleId
        let user = await User.findOne({ googleId: profile.id });

        // 🔥 if not found, check by email (important)
        if (!user) {
          user = await User.findOne({ email });
        }

        // 🔥 create user if not exists
        if (!user) {
          user = await User.create({
            name,
            email,
            googleId: profile.id,
          });
        } else {
          // 🔥 link google account if user exists
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        }

        return done(null, user);
      } catch (err) {
        console.error("Google Auth Error:", err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;