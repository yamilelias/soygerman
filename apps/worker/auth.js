const crypto = require("crypto");

function secretsMatch(provided, expected) {
  const left = crypto.createHash("sha256").update(String(provided)).digest();
  const right = crypto.createHash("sha256").update(String(expected)).digest();
  return crypto.timingSafeEqual(left, right);
}

function requireUser(supabase) {
  return async function requireUserMiddleware(req, res, next) {
    try {
      const provided = req.get("x-worker-secret") || "";
      const expected = process.env.WORKER_API_SECRET || "";
      if (!provided || !secretsMatch(provided, expected)) {
        res.status(401).json({ error: "No autorizado" });
        return;
      }

      const header = req.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token) {
        res.status(401).json({ error: "Token ausente" });
        return;
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        res.status(401).json({ error: "Sesión inválida" });
        return;
      }

      req.userId = data.user.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { requireUser };
