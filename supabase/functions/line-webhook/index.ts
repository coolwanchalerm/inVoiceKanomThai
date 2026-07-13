import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const LINE_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function replyLineMessage(replyToken: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] })
  });
}

async function replyLineFlex(replyToken: string, altText: string, flexContents: any) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'flex', altText: altText, contents: flexContents }] })
  });
}

function createPromptFlex(title: string, text: string, subText: string, buttons: any[]) {
  const contents = [
    { type: "text", text: text, wrap: true, size: "md" }
  ];
  if (subText) {
    contents.push({ type: "text", text: subText, wrap: true, size: "sm", color: "#aaaaaa", margin: "md" });
  }

  const footerButtons = buttons.map(b => {
    let button = {
      type: "button",
      style: b.style || "secondary",
      height: "sm",
      action: {
        type: "message",
        label: b.label,
        text: b.text
      }
    };
    if (b.color) (button as any).color = b.color;
    return button;
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: title, weight: "bold", color: "#ffffff", size: "md" }
      ],
      backgroundColor: "#1DB446"
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: contents
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: footerButtons
    }
  };
}

async function extractDataWithGroq(userText: string, currentDraft: any, askingFor: string) {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 7);
  const cYear = now.getUTCFullYear();
  const cMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
  const cDate = String(now.getUTCDate()).padStart(2, '0');

  let dynamicRule = "";
  if (askingFor === "customerName") {
      dynamicRule = `2. **โฟกัสปัจจุบัน (ชื่อลูกค้า)**: ตอนนี้ระบบต้องการ customerName
   - หากลูกค้าพิมพ์ข้อความสั้นๆ (เช่น น้ำหวาน, ลูกค้าทั่วไป) ให้ใส่ใน customerName ทันที ห้ามใส่ช่องอื่น
   - หากลูกค้าส่งรายการยาวๆ มา ห้ามเอาคำว่า "สรุปออเดอร์", "บิล", "รวม" มาเป็นชื่อลูกค้า หากไม่มีชื่อคนจริงๆ ให้ปล่อย customerName เป็น null`;
  } else if (askingFor === "date") {
      dynamicRule = `2. **โฟกัสปัจจุบัน (วันที่)**: ตอนนี้ระบบต้องการ date
   - หากลูกค้าพิมพ์สั้นๆ หรือตัวเลขโดดๆ ให้ถือว่าเป็นวันที่ทันที`;
  } else if (askingFor === "customerAddress") {
      dynamicRule = `2. **โฟกัสปัจจุบัน (ที่อยู่)**: ตอนนี้ระบบต้องการ customerAddress
   - หากลูกค้าพิมพ์ข้อความสั้นๆ (เช่น สกลราช, โรงเรียน, ส่งบ้าน) ให้ใส่ใน customerAddress ทันที ห้ามตีความเป็นสินค้าเด็ดขาด`;
  } else if (askingFor === "customerTaxId") {
      dynamicRule = `2. **โฟกัสปัจจุบัน (เลขภาษี)**: ตอนนี้ระบบต้องการ customerTaxId
   - หากลูกค้าพิมพ์สั้นๆ ให้ถือเป็นเลขภาษีทันที`;
  } else {
      dynamicRule = `2. นำข้อมูลไปเติมในช่องที่ยังว่าง (null) ให้ถูกต้อง`;
  }

  const prompt = `
คุณเป็นผู้ช่วยรับออเดอร์ร้านขนมไทย
หน้าที่ของคุณคือดึงข้อมูลจากข้อความของลูกค้า มาอัปเดตแบบฟอร์ม JSON ให้สมบูรณ์

ข้อมูลปัจจุบัน (Draft):
${JSON.stringify(currentDraft)}

ข้อความล่าสุดจากลูกค้า:
"${userText}"

คำแนะนำ:
1. นำข้อมูลจากข้อความล่าสุด ไปเติมในช่องที่ยังว่าง (null) หรือแก้ไขช่องเดิมหากลูกค้าต้องการแก้
${dynamicRule}
3. ข้อมูล "date" ต้องแปลงเป็นรูปแบบ YYYY-MM-DD (ค.ศ.) เท่านั้น!
   - ปีปัจจุบันคือ ${cYear}, เดือนปัจจุบันคือ ${cMonth}, วันนี้คือ ${cYear}-${cMonth}-${cDate}
   - หากลูกค้าพิมพ์ตัวเลขโดดๆ (เช่น 12) ให้ถือว่าเป็นวันที่ของเดือนนี้ -> "${cYear}-${cMonth}-12"
   - หากลูกค้าพิมพ์ "วันนี้" ให้ใส่ "${cYear}-${cMonth}-${cDate}"
   - หากลูกค้าระบุปีเป็น พ.ศ. (เช่น 69 หรือ 2569) ให้ลบ 543 เป็น ค.ศ. เสมอ
4. หากลูกค้าพิมพ์คำว่า "ข้าม" หรือ "-" สำหรับที่อยู่หรือเลขภาษี ให้ใส่ "-"
5. ช่อง items ให้เป็น array ของ object: { "description": string, "quantity": number, "unitPrice": number, "amount": number }
   (หากไม่ระบุราคา ให้ใส่ unitPrice=0, amount=quantity*unitPrice)
6. หากข้อมูลเก่าช่องไหนดีอยู่แล้ว ห้ามลบข้อมูลเก่าทิ้งเด็ดขาด 
7. ส่งกลับมาแค่ก้อน JSON เท่านั้น ห้ามมีคำอธิบาย

โครงสร้าง JSON (มีเท่านี้):
{
  "customerName": "...",
  "customerAddress": "...",
  "customerTaxId": "...",
  "date": "...",
  "items": [
    { "description": "...", "quantity": 1, "unitPrice": 10, "amount": 10 }
  ]
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0
      })
    });
    
    if (!res.ok) {
        const errText = await res.text();
        throw new Error("Groq API Error: " + errText);
    }

    const data = await res.json();
    if (data.choices && data.choices[0].message.content) {
      return JSON.parse(data.choices[0].message.content);
    }
  } catch(e: any) {
    throw new Error("Parse Error: " + e.message);
  }
  return currentDraft;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const events = body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userText = event.message.text.trim();
        const replyToken = event.replyToken;
        const lineUserId = event.source.userId;

        try {
          if (userText === 'ยกเลิก') {
            await supabase.from('bot_states').delete().eq('line_user_id', lineUserId);
            await replyLineMessage(replyToken, "🛑 ยกเลิกการสร้างบิลเรียบร้อยแล้วครับ");
            continue;
          }

          if (userText === 'สร้างบิล' || userText === 'บิลใหม่') {
            await supabase.from('bot_states').upsert({
              line_user_id: lineUserId,
              current_step: 'FILLING',
              draft_data: { customerName: null, customerAddress: null, customerTaxId: null, date: null, items: [] }
            });
            const flex = createPromptFlex(
              "📝 เริ่มสร้างบิลใหม่", 
              "ขอทราบ **ชื่อลูกค้า** ครับ", 
              "(หรือพิมพ์ข้อมูลทั้งหมดรวดเดียวมาได้เลย)", 
              [
                { label: "ลูกค้าทั่วไป", text: "ลูกค้าทั่วไป", style: "primary" },
                { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
              ]
            );
            await replyLineFlex(replyToken, "ขอทราบชื่อลูกค้า", flex);
            continue;
          }

          if (userText === 'ออเดอร์วันนี้' || userText === 'ออเดอร์พรุ่งนี้') {
            const now = new Date();
            now.setUTCHours(now.getUTCHours() + 7);
            if (userText === 'ออเดอร์พรุ่งนี้') {
              now.setDate(now.getDate() + 1);
            }
            const targetDateStr = now.toISOString().split('T')[0];

            const { data: orders, error } = await supabase
              .from('invoices')
              .select('*, invoice_items(*)')
              .eq('date', targetDateStr);
            
            if (error) throw error;

            if (!orders || orders.length === 0) {
              await replyLineMessage(replyToken, `ไม่มีออเดอร์สำหรับ${userText.replace('ออเดอร์', '')}ครับ`);
              continue;
            }

            const bubbles = orders.slice(0, 12).map((order: any) => {
              const items = (order.invoice_items || []).map((it: any) => ({
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: `${it.description} x${it.quantity}`, size: "sm", color: "#555555", flex: 1, wrap: true },
                  { type: "text", text: `฿${it.amount}`, size: "sm", color: "#111111", align: "end", flex: 0 }
                ]
              }));
              const statusColor = order.status === 'paid' ? '#1DB446' : order.status === 'shipped' ? '#3b82f6' : '#eab308';
              const statusText = order.status === 'paid' ? '🟢 จ่ายแล้ว' : order.status === 'shipped' ? '📦 ส่งแล้ว' : '🟡 รอโอน';
              
              return {
                type: "bubble",
                size: "micro",
                header: {
                  type: "box", layout: "vertical", backgroundColor: statusColor, paddingAll: "8px",
                  contents: [
                    { type: "text", text: statusText, color: "#ffffff", size: "xs", weight: "bold", align: "center" }
                  ]
                },
                body: {
                  type: "box", layout: "vertical", spacing: "sm", paddingAll: "12px",
                  contents: [
                    { type: "text", text: order.customer_name || 'ลูกค้าทั่วไป', weight: "bold", size: "sm", wrap: true },
                    { type: "text", text: `บิล: ${order.id}`, size: "xxs", color: "#aaaaaa" },
                    { type: "separator", margin: "md" },
                    ...items,
                    { type: "separator", margin: "md" },
                    { type: "box", layout: "horizontal", contents: [
                      { type: "text", text: "รวม", size: "sm", color: "#555555" },
                      { type: "text", text: `฿${order.total_amount}`, size: "sm", weight: "bold", align: "end" }
                    ]}
                  ]
                }
              };
            });

            await replyLineFlex(replyToken, userText, {
              type: "carousel",
              contents: bubbles
            });
            continue;
          }

          if (userText === 'สรุปยอด') {
            const now = new Date();
            now.setUTCHours(now.getUTCHours() + 7);
            const yearMonth = now.toISOString().substring(0, 7);
            const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
            const monthName = monthNames[now.getMonth()];

            const { data: monthOrders, error } = await supabase
              .from('invoices')
              .select('*')
              .like('date', `${yearMonth}%`);
            
            if (error) throw error;

            const orders = monthOrders || [];
            const totalSales = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
            
            const pendingCount = orders.filter((o: any) => o.status === 'pending').length;
            const paidCount = orders.filter((o: any) => o.status === 'paid').length;
            const shippedCount = orders.filter((o: any) => o.status === 'shipped').length;

            const flex = {
              type: "bubble",
              size: "mega",
              header: {
                type: "box", layout: "vertical", backgroundColor: "#4f46e5", paddingAll: "16px",
                contents: [
                  { type: "text", text: `สรุปยอดเดือน ${monthName}`, color: "#ffffff", size: "lg", weight: "bold" },
                  { type: "text", text: "รวมทุกสถานะ", color: "#e0e7ff", size: "sm" }
                ]
              },
              body: {
                type: "box", layout: "vertical", spacing: "md", paddingAll: "20px",
                contents: [
                  {
                    type: "box", layout: "vertical", alignItems: "center", margin: "lg",
                    contents: [
                      { type: "text", text: "ยอดขายรวม", size: "sm", color: "#64748b" },
                      { type: "text", text: `฿${totalSales.toLocaleString()}`, size: "3xl", weight: "bold", color: "#0f172a" }
                    ]
                  },
                  { type: "separator", margin: "xl" },
                  {
                    type: "box", layout: "horizontal", margin: "lg",
                    contents: [
                      { type: "text", text: "จำนวนบิลทั้งหมด", size: "sm", color: "#475569" },
                      { type: "text", text: `${orders.length} บิล`, size: "md", weight: "bold", color: "#0f172a", align: "end" }
                    ]
                  },
                  {
                    type: "box", layout: "horizontal", margin: "sm",
                    contents: [
                      { type: "text", text: "🟡 รอโอน", size: "xs", color: "#64748b" },
                      { type: "text", text: `${pendingCount} บิล`, size: "xs", color: "#0f172a", align: "end" }
                    ]
                  },
                  {
                    type: "box", layout: "horizontal", margin: "sm",
                    contents: [
                      { type: "text", text: "🟢 จ่ายแล้ว", size: "xs", color: "#64748b" },
                      { type: "text", text: `${paidCount} บิล`, size: "xs", color: "#0f172a", align: "end" }
                    ]
                  },
                  {
                    type: "box", layout: "horizontal", margin: "sm",
                    contents: [
                      { type: "text", text: "📦 ส่งแล้ว", size: "xs", color: "#64748b" },
                      { type: "text", text: `${shippedCount} บิล`, size: "xs", color: "#0f172a", align: "end" }
                    ]
                  }
                ]
              }
            };

            await replyLineFlex(replyToken, "สรุปยอดรายเดือน", flex);
            continue;
          }

          // Fetch current state
          const { data: stateData } = await supabase
            .from('bot_states')
            .select('*')
            .eq('line_user_id', lineUserId)
            .single();

          let draft = stateData?.draft_data || { customerName: null, customerAddress: null, customerTaxId: null, date: null, items: [] };

          if (userText === 'แก้ไขข้อมูล' && stateData?.current_step === 'CONFIRM') {
             await replyLineMessage(replyToken, "✏️ พิมพ์สิ่งที่คุณต้องการแก้ไขส่งมาได้เลยครับ\n(เช่น 'แก้ชื่อเป็นสมชาย', 'เปลี่ยนที่อยู่เป็น...', 'เพิ่มขนมชั้น 5 ชิ้น')");
             continue;
          }

          if (userText === 'ยืนยัน' && stateData?.current_step === 'CONFIRM') {
            // Save to DB
            const invoiceId = Date.now().toString();
            const { data: invData, error: invError } = await supabase
              .from('invoices')
              .insert({
                id: invoiceId,
                customer_name: draft.customerName,
                customer_address: draft.customerAddress || "-",
                customer_tax_id: draft.customerTaxId || "-",
                date: draft.date,
                total_amount: draft.totalAmount || 0
              })
              .select()
              .single();

            if (invError) throw invError;

            const itemsToInsert = draft.items.map((it: any) => ({
              invoice_id: invoiceId,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unitPrice,
              amount: it.amount
            }));

            if (itemsToInsert.length > 0) {
                const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
            }

            // Clear state
            await supabase.from('bot_states').delete().eq('line_user_id', lineUserId);
            
            // Build Flex Message (Success)
            const itemBoxes = draft.items.map((it: any) => ({
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `${it.description} ฿${it.unitPrice} x${it.quantity}`, size: "sm", color: "#555555", flex: 0, wrap: true },
                { type: "text", text: `฿${it.amount}`, size: "sm", color: "#111111", align: "end" }
              ]
            }));

            const flexContents = {
              type: "bubble",
              header: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "RECEIPT", weight: "bold", color: "#1DB446", size: "sm" },
                  { type: "text", text: "บิลเงินสด", weight: "bold", size: "xl", margin: "md" },
                  { type: "text", text: "บันทึกข้อมูลเข้าระบบเรียบร้อย", size: "xs", color: "#aaaaaa", wrap: true }
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
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ลูกค้า", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.customerName, size: "sm", color: "#111111", align: "end" } ] },
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "วันที่", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.date, size: "sm", color: "#111111", align: "end" } ] }
                    ]
                  },
                  { type: "separator", margin: "xxl" },
                  { type: "box", layout: "vertical", margin: "xxl", spacing: "sm", contents: itemBoxes },
                  { type: "separator", margin: "xxl" },
                  {
                    type: "box", layout: "horizontal", margin: "md",
                    contents: [
                      { type: "text", text: "ยอดรวม", size: "md", color: "#555555" },
                      { type: "text", text: `฿${draft.totalAmount || 0}`, size: "lg", color: "#1DB446", align: "end", weight: "bold" }
                    ]
                  }
                ]
              },
              styles: { footer: { separator: true } }
            };
            
            await replyLineFlex(replyToken, "✅ บันทึกบิลสำเร็จ", flexContents);
            continue;
          }

          let askingFor = "";
          if (!draft.customerName) askingFor = "customerName";
          else if (!draft.date) askingFor = "date";
          else if (!draft.customerAddress) askingFor = "customerAddress";
          else if (!draft.customerTaxId) askingFor = "customerTaxId";
          else if (!draft.items || draft.items.length === 0) askingFor = "items";

          // Use AI to extract data
          draft = await extractDataWithGroq(userText, draft, askingFor);
          
          const totalAmount = draft.items?.reduce((sum: number, it: any) => sum + (it.amount || 0), 0) || 0;
          draft.totalAmount = totalAmount;

          await supabase.from('bot_states').upsert({
            line_user_id: lineUserId,
            current_step: 'FILLING',
            draft_data: draft
          });

          // Check for missing slots
          if (!draft.customerName) {
            const flex = createPromptFlex("📝 ต้องการข้อมูลเพิ่มเติม", "ขอทราบ **ชื่อลูกค้า** ครับ", "", [
              { label: "ลูกค้าทั่วไป", text: "ลูกค้าทั่วไป", style: "primary" },
              { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
            ]);
            await replyLineFlex(replyToken, "ขอทราบชื่อลูกค้า", flex);
            
          } else if (!draft.date) {
            const flex = createPromptFlex("📝 ต้องการข้อมูลเพิ่มเติม", "ขอทราบวันที่ครับ (พิมพ์ตัวเลข)", "", [
              { label: "วันนี้", text: "วันนี้", style: "primary" },
              { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
            ]);
            await replyLineFlex(replyToken, "ขอทราบวันที่", flex);
            
          } else if (!draft.customerAddress) {
            const flex = createPromptFlex("📝 ต้องการข้อมูลเพิ่มเติม", "ขอทราบ **ที่อยู่** ครับ", "(ถ้าไม่มีพิมพ์ 'ข้าม' หรือ '-')", [
              { label: "ข้าม", text: "ข้าม", style: "primary" },
              { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
            ]);
            await replyLineFlex(replyToken, "ขอทราบที่อยู่", flex);
            
          } else if (!draft.customerTaxId) {
            const flex = createPromptFlex("📝 ต้องการข้อมูลเพิ่มเติม", "ขอทราบ **เลขประจำตัวผู้เสียภาษี** ครับ", "(ถ้าไม่มีพิมพ์ 'ข้าม' หรือ '-')", [
              { label: "ข้าม", text: "ข้าม", style: "primary" },
              { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
            ]);
            await replyLineFlex(replyToken, "ขอทราบเลขภาษี", flex);
            
          } else if (!draft.items || draft.items.length === 0) {
            const flex = createPromptFlex("📝 ต้องการข้อมูลเพิ่มเติม", "ขอทราบ **รายการสินค้า** ครับ", "พิมพ์ชื่อสินค้า จำนวน และราคามาได้เลย", [
              { label: "ยกเลิก", text: "ยกเลิก", style: "link", color: "#ff3344" }
            ]);
            await replyLineFlex(replyToken, "ขอทราบรายการสินค้า", flex);
            
          } else {
            // All filled! Prompt for confirmation
            await supabase.from('bot_states').update({ current_step: 'CONFIRM' }).eq('line_user_id', lineUserId);
            
            const itemBoxes = draft.items.map((it: any) => ({
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `${it.description} ฿${it.unitPrice} x${it.quantity}`, size: "sm", color: "#555555", flex: 0, wrap: true },
                { type: "text", text: `฿${it.amount}`, size: "sm", color: "#111111", align: "end" }
              ]
            }));

            const confirmFlexContents = {
              type: "bubble",
              header: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "ตรวจสอบข้อมูล", weight: "bold", color: "#ffffff", size: "md" }
                ],
                backgroundColor: "#1DB446"
              },
              body: {
                type: "box",
                layout: "vertical",
                contents: [
                  { type: "text", text: "ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก", size: "xs", color: "#aaaaaa", wrap: true },
                  { type: "separator", margin: "md" },
                  {
                    type: "box", layout: "vertical", margin: "md", spacing: "sm",
                    contents: [
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ลูกค้า", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.customerName, size: "sm", color: "#111111", align: "end", wrap: true } ] },
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "ที่อยู่", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.customerAddress, size: "sm", color: "#111111", align: "end", wrap: true } ] },
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "เลขภาษี", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.customerTaxId, size: "sm", color: "#111111", align: "end", wrap: true } ] },
                      { type: "box", layout: "horizontal", contents: [ { type: "text", text: "วันที่", size: "sm", color: "#555555", flex: 0 }, { type: "text", text: draft.date, size: "sm", color: "#111111", align: "end", wrap: true } ] }
                    ]
                  },
                  { type: "separator", margin: "md" },
                  { type: "box", layout: "vertical", margin: "md", spacing: "sm", contents: itemBoxes },
                  { type: "separator", margin: "md" },
                  {
                    type: "box", layout: "horizontal", margin: "md",
                    contents: [
                      { type: "text", text: "ยอดรวม", size: "md", color: "#555555" },
                      { type: "text", text: `฿${draft.totalAmount || 0}`, size: "lg", color: "#1DB446", align: "end", weight: "bold" }
                    ]
                  }
                ]
              },
              footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  { type: "button", style: "primary", height: "sm", action: { type: "message", label: "ยืนยัน (ถูกต้อง)", text: "ยืนยัน" } },
                  { type: "button", style: "secondary", height: "sm", action: { type: "message", label: "แก้ไขข้อมูล", text: "แก้ไขข้อมูล" } },
                  { type: "button", style: "link", color: "#ff3344", height: "sm", action: { type: "message", label: "ยกเลิก (เริ่มใหม่)", text: "ยกเลิก" } }
                ]
              }
            };
            
            await replyLineFlex(replyToken, "ตรวจสอบข้อมูลก่อนบันทึก", confirmFlexContents);
          }

        } catch (err: any) {
          console.error(err);
          await replyLineMessage(replyToken, `เกิดข้อผิดพลาด: ${err.message}`);
        }
      }
    }
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
