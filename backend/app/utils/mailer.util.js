const nodemailer = require("nodemailer");

function createTransporter() {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      "Mail user or app password is not defined in environment variables.",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}
async function sendActivationEmail({ to, name, activationLink }) {
  const transporter = createTransporter();

  const from = `Fresh Mart <${process.env.MAIL_USER}>`;
  const subject = "Kích hoạt tài khoản của bạn";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5">
      <h2>Xin chào ${name || "bạn"},</h2>
      <p>Cảm ơn bạn đã đăng ký. Vui lòng bấm vào nút bên dưới để kích hoạt tài khoản:</p>
      <p>
        <a href="${activationLink}"
           style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px">
          Kích hoạt tài khoản
        </a>
      </p>
      <p>Nếu bạn không đăng ký, hãy bỏ qua email này.</p>
    </div>
  `;

  return transporter.sendMail({ from, to, subject, html });
}

async function sendResetPasswordEmail({ to, name, resetLink, expiresMinutes }) {
  const transporter = createTransporter();

  const from = `Fresh Mart <${process.env.MAIL_USER}>`;
  const subject = "Đặt lại mật khẩu";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5">
      <h2>Xin chào ${name || "bạn"},</h2>
      <p>Bạn vừa yêu cầu đặt lại mật khẩu. Bấm nút bên dưới để tiếp tục:</p>
      <p>
        <a href="${resetLink}"
           style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:8px">
          Đặt lại mật khẩu
        </a>
      </p>
      <p>Link sẽ hết hạn sau <b>${expiresMinutes || 15} phút</b>.</p>
      <p>Nếu không phải bạn, hãy bỏ qua email này.</p>
    </div>
  `;

  return transporter.sendMail({ from, to, subject, html });
}

async function sendContactReplyEmail({
  to,
  name,
  subject,
  originalContent,
  adminReply,
}) {
  const transporter = createTransporter();

  const from = `Fresh Mart <${process.env.MAIL_USER}>`;
  const mailSubject = `Phản hồi liên hệ: ${subject}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333">
      <h2>Xin chào ${name || "bạn"},</h2>

      <p>Chúng tôi đã nhận được liên hệ của bạn với nội dung:</p>

      <div style="padding:12px;background:#f5f7fa;border-left:4px solid #999;margin:10px 0">
        ${String(originalContent).replace(/\n/g, "<br>")}
      </div>

      <p><strong>Phản hồi từ chúng tôi:</strong></p>

      <div style="padding:12px;background:#e8f7f5;border-left:4px solid #49c5b6;margin:10px 0">
        ${String(adminReply).replace(/\n/g, "<br>")}
      </div>

      <p>Trân trọng,<br><strong>Fresh Mart</strong></p>
    </div>
  `;

  return transporter.sendMail({
    from,
    to,
    subject: mailSubject,
    html,
  });
}

async function sendInvoiceEmail({ to, customerName, order }) {
  const transporter = createTransporter();

  const from = `Fresh Mart <${process.env.MAIL_USER}>`;
  const subject = `Hóa đơn đơn hàng #${order._id}`;

  const itemsHtml = (order.items || [])
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${item.name || "---"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity || 0}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${Number(item.price || 0).toLocaleString("vi-VN")} VND</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${Number(item.subtotal || item.price * item.quantity || 0).toLocaleString("vi-VN")} VND</td>
        </tr>
      `,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
      <h2>Hóa đơn đơn hàng</h2>
      <p>Xin chào <strong>${customerName || "quý khách"}</strong>,</p>
      <p>Cảm ơn bạn đã mua hàng tại Fresh Mart. Dưới đây là thông tin hóa đơn của bạn:</p>

      <div style="margin:16px 0;padding:12px;background:#f8f9fa;border:1px solid #e5e7eb;">
        <p><strong>Mã đơn hàng:</strong> ${order._id}</p>
        <p><strong>Ngày tạo:</strong> ${new Date(order.created_at).toLocaleString("vi-VN")}</p>
        <p><strong>Trạng thái:</strong> ${order.status_text || order.status || "---"}</p>
        <p><strong>Phương thức thanh toán:</strong> ${(order.payment_method || "cod").toUpperCase()}</p>
      </div>

      <h3>Thông tin nhận hàng</h3>
      <div style="margin-bottom:16px;padding:12px;background:#f8f9fa;border:1px solid #e5e7eb;">
        <p><strong>Người nhận:</strong> ${order.shipping_address?.fullName || "---"}</p>
        <p><strong>Số điện thoại:</strong> ${order.shipping_address?.phone || "---"}</p>
        <p><strong>Địa chỉ:</strong> ${order.shipping_address?.address || "---"}</p>
        <p><strong>Thành phố:</strong> ${order.shipping_address?.city || "---"}</p>
      </div>

      <h3>Sản phẩm</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Sản phẩm</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:center;">SL</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Đơn giá</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="margin-top:16px;padding:12px;background:#eefaf7;border:1px solid #cdeee4;">
        <p><strong>Tiền hàng:</strong> ${Number(order.subtotal_price ?? order.total_price ?? 0).toLocaleString("vi-VN")} VND</p>
        <p><strong>Phí vận chuyển:</strong> ${Number(order.shipping_fee || 0).toLocaleString("vi-VN")} VND</p>
        <p style="font-size:18px;"><strong>Tổng thanh toán:</strong> ${Number(order.total_price ?? (Number(order.subtotal_price || 0) + Number(order.shipping_fee || 0))).toLocaleString("vi-VN")} VND</p>
      </div>

      <p style="margin-top:20px;">Trân trọng,<br><strong>Fresh Mart</strong></p>
    </div>
  `;

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

module.exports = {
  sendActivationEmail,
  sendResetPasswordEmail,
  sendContactReplyEmail,
  sendInvoiceEmail,
};
