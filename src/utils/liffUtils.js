import liff from '@line/liff';

// Convert invoice data into LINE Flex Message format
export const createInvoiceFlexMessage = (invoice, items) => {
  const itemBoxes = items.map(it => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: `${it.description} ฿${it.unitPrice} x${it.quantity}`, size: "sm", color: "#555555", flex: 0, wrap: true },
      { type: "text", text: `฿${it.amount}`, size: "sm", color: "#111111", align: "end" }
    ]
  }));

  return {
    type: "flex",
    altText: "ใบเสร็จรับเงินจากร้านขนมไทยแทนคุณ",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "RECEIPT", weight: "bold", color: "#1DB446", size: "sm" },
          { type: "text", text: "บิลเงินสด", weight: "bold", size: "xl", margin: "md" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "separator", margin: "xxl" },
          {
            type: "box", layout: "vertical", margin: "xxl", spacing: "sm",
            contents: [
              { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ลูกค้า", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: invoice.customerName, size: "sm", color: "#111111", align: "end" } ] },
              { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ที่อยู่", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: invoice.customerAddress || "-", size: "sm", color: "#111111", align: "end", wrap: true } ] },
              { type: "box", layout: "horizontal", contents: [ { type: "text", text: "วันที่", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: invoice.date, size: "sm", color: "#111111", align: "end" } ] }
            ]
          },
          { type: "separator", margin: "xxl" },
          { type: "box", layout: "vertical", margin: "xxl", spacing: "sm", contents: itemBoxes },
          { type: "separator", margin: "xxl" },
          {
            type: "box", layout: "horizontal", margin: "md",
            contents: [
              { type: "text", text: "ยอดรวม", size: "md", color: "#555555" },
              { type: "text", text: `฿${invoice.totalAmount || 0}`, size: "lg", color: "#1DB446", align: "end", weight: "bold" }
            ]
          }
        ]
      },
      styles: { footer: { separator: true } }
    }
  };
};

export const shareToLineChat = async (invoice, items) => {
  try {
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    if (!liff.isApiAvailable('shareTargetPicker')) {
      throw new Error('LINE เวอร์ชันของคุณไม่รองรับฟีเจอร์แชร์ข้อมูล (Share Target Picker)');
    }

    const flexMessage = createInvoiceFlexMessage(invoice, items);

    const res = await liff.shareTargetPicker([flexMessage]);
    if (res) {
      // Message sent
      return true;
    } else {
      // User cancelled
      return false;
    }
  } catch (error) {
    console.error('Error sharing flex message:', error);
    throw error;
  }
};
