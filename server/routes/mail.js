const router = require("express").Router();
const nodemailer = require("nodemailer");
const Mail = require("../models/Mail");
const auth = require("../middleware/auth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 500;
const BATCH_SIZE = 10; // emails sent in parallel

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

router.use(auth);

// Send a bulk mail. Each recipient gets their own message so addresses stay private.
router.post("/send", async (req, res) => {
  try {
    const { subject, body } = req.body || {};
    const raw = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
    const recipients = [...new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];

    if (!subject?.trim()) return res.status(400).json({ message: "Subject is required." });
    if (!body?.trim()) return res.status(400).json({ message: "Email body is required." });
    if (!recipients.length) return res.status(400).json({ message: "Add at least one recipient." });
    if (recipients.length > MAX_RECIPIENTS)
      return res.status(400).json({ message: `Limit is ${MAX_RECIPIENTS} recipients per send.` });
    const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length)
      return res.status(400).json({ message: `Invalid address: ${invalid.slice(0, 5).join(", ")}` });

    const results = [];
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((to) =>
          transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            subject,
            text: body,
            html: `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(body)}</div>`,
          })
        )
      );
      settled.forEach((r, idx) => {
        const email = batch[idx];
        if (r.status === "fulfilled") results.push({ email, status: "sent" });
        else {
          console.error(`[mail] failed -> ${email}: ${r.reason?.message}`);
          results.push({ email, status: "failed", error: r.reason?.message });
        }
      });
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.length - sentCount;
    const status = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";

    const record = await Mail.create({
      subject, body, recipients, results, sentCount, failedCount, status, sentBy: req.user.email,
    });
    console.log(`[mail] "${subject}" -> ${sentCount} sent, ${failedCount} failed (${status})`);

    res.status(status === "failed" ? 502 : 201).json({
      message:
        status === "sent" ? `Sent to all ${sentCount} recipients.`
        : status === "partial" ? `Sent to ${sentCount}, failed for ${failedCount}. See history for details.`
        : "No emails were delivered. Check your SMTP settings.",
      mail: record,
    });
  } catch (err) {
    console.error("[mail] send error:", err);
    res.status(500).json({ message: "Something went wrong while sending." });
  }
});

// History (newest first, paginated)
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);
    const [items, total] = await Promise.all([
      Mail.find().select("-body -results").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Mail.countDocuments(),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[mail] history error:", err);
    res.status(500).json({ message: "Could not load history." });
  }
});

// Single record with body + per-recipient results
router.get("/:id", async (req, res) => {
  try {
    const mail = await Mail.findById(req.params.id);
    if (!mail) return res.status(404).json({ message: "Mail not found." });
    res.json(mail);
  } catch {
    res.status(400).json({ message: "Invalid mail id." });
  }
});

module.exports = router;
