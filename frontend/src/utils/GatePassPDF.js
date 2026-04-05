/**
 * GatePassPDF.js - DIRECT DOWNLOAD VERSION
 * 
 * Generates a real .pdf file and triggers an automatic download 
 * by loading jsPDF and html2canvas via CDN. No npm install needed.
 */

// Helper to load external scripts dynamically
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

export const downloadGatePassPDF = async (pass) => {
  try {
    // 1. Load dependencies from CDN (high reliability)
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    ]);

    const { jsPDF } = window.jspdf;

    // 2. Prepare Data
    const studentName = pass.Name              || 'Student';
    const regNumber   = pass.RegisterNumber    || 'N/A';
    const destination = pass.Destination       || 'N/A';
    const passType    = pass.PassType          || 'Local';
    const outTime     = pass.OutTime           ? new Date(pass.OutTime).toLocaleString('en-IN')             : 'N/A';
    const returnTime  = pass.ExpectedReturnTime ? new Date(pass.ExpectedReturnTime).toLocaleString('en-IN') : 'N/A';
    const passId      = pass.PassID || pass.id || pass.ID || 'AUTO';
    const qrHash      = pass.QRCodeHash        || regNumber;
    const qrImageUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrHash)}`;

    // 3. Create a Hidden Template for Capture
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '600px';
    container.style.padding = '0';
    container.style.margin = '0';

    container.innerHTML = `
      <div style="background: white; border: 4px solid #1e40af; border-radius: 20px; overflow: hidden; font-family: 'Inter', sans-serif; color: #1e293b;">
        <!-- Header -->
        <div style="background: #1e3a8a; padding: 25px 35px; color: white; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800;">Secure Hostel Portal</h1>
            <p style="margin: 5px 0 0; opacity: 0.8; font-size: 11px; font-weight: bold; text-transform: uppercase;">Official Digital Outpass Backup</p>
          </div>
          <div style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); padding: 8px 18px; border-radius: 25px; font-size: 12px; font-weight: 800;">
            ${passType.toUpperCase()} OUTPASS
          </div>
        </div>
        
        <!-- Content Body -->
        <div style="padding: 40px; display: flex; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="margin-bottom: 25px;">
              <small style="color: #94a3b8; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Student Identity</small>
              <div style="font-size: 22px; font-weight: 800; margin-top: 5px; color: #0f172a;">${studentName}</div>
              <div style="font-size: 15px; color: #1d4ed8; font-weight: 700; margin-top: 2px;">Reg No: ${regNumber}</div>
            </div>
            
            <div style="margin-bottom: 30px;">
              <small style="color: #94a3b8; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Destination & Reason</small>
              <div style="font-size: 15px; font-weight: 700; margin-top: 5px; color: #1e293b;">${destination}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 3px;">${pass.Reason || 'No reason specified'}</div>
            </div>

            <!-- Time Box -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 15px; padding: 22px; display: flex; gap: 40px;">
              <div>
                <small style="color: #94a3b8; font-size: 9px; font-weight: 800; text-transform: uppercase;">Out Time</small>
                <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 3px;">${outTime}</div>
              </div>
              <div>
                <small style="color: #94a3b8; font-size: 9px; font-weight: 800; text-transform: uppercase;">Expected Return</small>
                <div style="font-size: 14px; font-weight: 800; color: #dc2626; margin-top: 3px;">${returnTime}</div>
              </div>
            </div>
          </div>

          <!-- QR Panel -->
          <div style="width: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; margin-left: 35px; border: 1px solid #e2e8f0; border-radius: 18px; padding: 25px;">
            <img src="${qrImageUrl}" style="width: 150px; height: 150px; margin-bottom: 15px; background: white; border-radius: 10px;" />
            <div style="font-size: 9px; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 5px;">Pass ID</div>
            <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; background: #e0e7ff; padding: 5px 15px; border-radius: 10px;">PASS-${passId}</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 2px dashed #e2e8f0; padding: 30px; display: flex; justify-content: space-between; align-items: center; background: white;">
          <div style="font-size: 10px; color: #94a3b8; max-width: 320px; line-height: 1.5;">
            🛡️ <b>Security Notice:</b> This document is a physical backup. Verification is conducted via real-time QR scan at the gate. Any tampering is electronically trackable.
          </div>
          <div style="text-align: center;">
            <div style="font-family: 'Times New Roman', serif; font-style: italic; font-size: 20px; color: #1e3a8a;">Warden Approved</div>
            <div style="width: 170px; border-bottom: 2px solid #1e3a8a; margin: 6px auto;"></div>
            <div style="font-size: 10px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px;">Official Signatory</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // 4. Capture Template to Image
    const canvas = await window.html2canvas(container, {
      scale: 3, // Very high resolution for printing
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff"
    });
    
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    
    // 5. Generate A4 PDF
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 190; // A4 width (210) - margins (20)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Center it on page
    pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight);
    
    // 6. FORCE DOWNLOAD
    pdf.save(`GatePass_${regNumber}_${new Date().getTime()}.pdf`);

  } catch (error) {
    console.error("PDF Generation Error:", error);
    alert("PDF generation failed. Please check your internet connection.");
  }
};
