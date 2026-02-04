// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { requireServerAuth } from "@/lib/auth-server";
import { employeeWhereFor } from "@/lib/employee-scope";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function RenderEmployeeCardPage({
      params,
    }) {
  const { id } = await params;

  const auth = await requireServerAuth();
  const whereScope = employeeWhereFor(auth);

  const e = await prisma.employee.findFirst({
    where: { id, ...whereScope },
    select: {
      firstName: true,
      lastName: true,
      qrCodeValue: true,
      defaultDayRate: true,
      faceImageUrl: true,
      isActive: true,
    },
  });

  if (!e) return null;

  const qrDataUrl = await QRCode.toDataURL(e.qrCodeValue, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    type: "image/png",
  });

  const dayRate = Number(String(e.defaultDayRate).replace(",", "."));
  const rateText = Number.isFinite(dayRate)
    ? `R ${dayRate.toFixed(2)}`
    : `R ${e.defaultDayRate}`;

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Keep fonts simple and local for speed/reliability */}
        <style>{`
          * { box-sizing: border-box; }
          body { margin: 0; background: transparent; }
          .wrap {
            width: 85.6mm;
            height: 54mm;
            padding: 3mm;
            background: white;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
          }
          .card {
            width: 100%;
            height: 100%;
            border: 1px solid #E5E7EB;
            border-radius: 14px;
            overflow: hidden;
            background: #fff;
          }
          .header {
            height: 12mm;
            background: #0B1220;
            padding: 9px 12px;
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .brand { font-size: 18px; font-weight: 800; line-height: 1.05; }
          .sub { font-size: 10px; opacity: 0.85; letter-spacing: 0.6px; }
          .body {
            display: flex;
            gap: 12px;
            padding: 12px;
          }
          .left { flex: 1; min-width: 0; }
          .label { font-size: 10px; color: #6B7280; margin-bottom: 3px; }
          .valueBig { font-size: 16px; font-weight: 800; color: #111827; line-height: 1.15; }
          .valueMid { font-size: 14px; font-weight: 800; color: #111827; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
          .muted { color: #6B7280; }
          .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: 1px solid #E5E7EB;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 10px;
            color: #111827;
            margin-top: 6px;
            width: fit-content;
            background: #F9FAFB;
          }
          .qrBox {
            width: 32mm;
            height: 32mm;
            border-radius: 14px;
            border: 1px solid #E5E7EB;
            background: #F9FAFB;
            display: grid;
            place-items: center;
            padding: 6px;
          }
          .qrImg { width: 100%; height: 100%; object-fit: contain; }
          .footer {
            padding: 0 12px 12px;
          }
          .divider { height: 1px; background: #E5E7EB; margin-top: 2px; margin-bottom: 8px; }
          .note { font-size: 10px; color: #6B7280; line-height: 1.2; }

          .row { margin-top: 10px; }
          .small { font-size: 10px; }
          .payload { font-size: 10px; font-weight: 700; color: #111827; overflow-wrap: anywhere; }

          .topline {
            display:flex; align-items:center; gap:10px; margin-bottom: 6px;
          }
          .avatar {
            width: 14mm; height: 14mm;
            border-radius: 10px;
            border: 1px solid #E5E7EB;
            background: #F3F4F6;
            overflow: hidden;
            display:grid;
            place-items:center;
            font-weight: 800;
            color: #374151;
          }
          .avatar img { width: 100%; height: 100%; object-fit: cover; }
        `}</style>
      </head>

      <body>
        <div className="wrap">
          <div className="card">
            <div className="header">
              <div className="brand">FirstClass Projects</div>
              <div className="sub">WORKER ATTENDANCE CARD</div>
            </div>

            <div className="body">
              <div className="left">
                <div className="topline">
                  <div className="avatar">
                    {e.faceImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.faceImageUrl} alt="face" />
                    ) : (
                      <span>
                        {(e.firstName?.[0] ?? "").toUpperCase()}
                        {(e.lastName?.[0] ?? "").toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div className="label">Worker Name</div>
                    <div className="valueBig">
                      {e.firstName} {e.lastName}
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="label">Worker Code</div>
                  <div className="valueMid mono">
                    {e.qrCodeValue.replace(/^EMP_/, "")}
                  </div>
                </div>

                <div className="row">
                  <div className="label">QR Payload</div>
                  <div className="payload mono">{e.qrCodeValue}</div>
                </div>

                <div className="pill">
                  <span className="muted">Day Rate:</span>
                  <b>{rateText}</b>
                </div>

                {!e.isActive && (
                  <div
                    className="pill"
                    style={{
                      borderColor: "#FCA5A5",
                      background: "#FEF2F2",
                      color: "#991B1B",
                    }}
                  >
                    INACTIVE
                  </div>
                )}
              </div>

              <div className="qrBox">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="qrImg" src={qrDataUrl} alt="QR" />
              </div>
            </div>

            <div className="footer">
              <div className="divider" />
              <div className="note">
                Scan this card daily on the site attendance app. No scan = no
                booking.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
