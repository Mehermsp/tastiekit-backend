const axios = require("axios");

async function sendEmail(to, subject, htmlContent) {
    try {
        await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "tastiekit",
                    email: "tastiekit@gmail.com",
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: htmlContent,
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("Email sent to:", to);
    } catch (err) {
        console.error("Brevo error:", err.response?.data || err.message);
        throw err;
    }
}

const formatDeliveryPartnerHtml = (partner) => `
    <div style="margin-top:20px; padding:16px; background:#fff4f4; border-radius:12px;">
      <h3 style="margin:0 0 10px; color:#E53935;">Delivery Partner Details</h3>
      <p style="margin:4px 0;"><strong>Name:</strong> ${partner.name}</p>
      <p style="margin:4px 0;"><strong>Phone:</strong> ${partner.phone || "Not available"}</p>
    </div>
`;

module.exports = {
    sendEmail,
    formatDeliveryPartnerHtml,
};
