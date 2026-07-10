import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const LINE_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

function parseItem(text: string) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return null;
  
  let unitPrice = 0;
  let quantity = 1;
  let description = '';

  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];

  if (parts.length >= 3 && !isNaN(Number(lastPart)) && !isNaN(Number(secondLastPart))) {
    unitPrice = Number(lastPart);
    quantity = Number(secondLastPart);
    description = parts.slice(0, -2).join(' ');
  } else if (!isNaN(Number(lastPart))) {
    quantity = Number(lastPart);
    description = parts.slice(0, -1).join(' ');
  } else {
    return null;
  }
  return { description, quantity, unitPrice, amount: quantity * unitPrice };
}

function parseDate(dayStr: string) {
  if (dayStr.includes('วัน')) {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 7);
    return now.toISOString().split('T')[0];
  }
  const day = parseInt(dayStr);
  if (isNaN(day) || day < 1 || day > 31) return null;
  
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 7);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dayPadded = String(day).padStart(2, '0');
  return `${year}-${month}-${dayPadded}`;
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
              current_step: 'WAITING_NAME',
              draft_data: { items: [] }
            });
            await replyLineMessage(replyToken, "📝 เริ่มสร้างบิลใหม่\nขอทราบ **ชื่อลูกค้า** ครับ");
            continue;
          }

          // Fetch current state
          const { data: stateData } = await supabase
            .from('bot_states')
            .select('*')
            .eq('line_user_id', lineUserId)
            .single();

          if (!stateData) {
            await replyLineMessage(replyToken, "หากต้องการสร้างบิลใหม่ พิมพ์คำว่า **สร้างบิล** ได้เลยครับ");
            continue;
          }

          const step = stateData.current_step;
          let draft = stateData.draft_data || { items: [] };

          if (step === 'WAITING_NAME') {
            draft.customerName = userText;
            await supabase.from('bot_states').update({ current_step: 'WAITING_ADDRESS', draft_data: draft }).eq('line_user_id', lineUserId);
            await replyLineMessage(replyToken, `ลูกค้า: ${userText}\n\nขอทราบ **ที่อยู่ลูกค้า** ครับ\n(หากไม่มีที่อยู่ ให้พิมพ์ - หรือ ข้าม)`);
          
          } else if (step === 'WAITING_ADDRESS') {
            draft.customerAddress = (userText === 'ข้าม' || userText === '-') ? '-' : userText;
            await supabase.from('bot_states').update({ current_step: 'WAITING_TAX_ID', draft_data: draft }).eq('line_user_id', lineUserId);
            await replyLineMessage(replyToken, `ที่อยู่: ${draft.customerAddress}\n\nขอทราบ **เลขประจำตัวผู้เสียภาษี** ครับ\n(หากไม่มี ให้พิมพ์ - หรือ ข้าม)`);

          } else if (step === 'WAITING_TAX_ID') {
            draft.customerTaxId = (userText === 'ข้าม' || userText === '-') ? '-' : userText;
            await supabase.from('bot_states').update({ current_step: 'WAITING_DATE', draft_data: draft }).eq('line_user_id', lineUserId);
            await replyLineMessage(replyToken, `เลขผู้เสียภาษี: ${draft.customerTaxId}\n\nขอทราบ **วันที่** ครับ\n(พิมพ์เฉพาะตัวเลขวันที่ เช่น 18 หรือพิมพ์ วันนี้)`);
          
          } else if (step === 'WAITING_DATE') {
            const parsedDate = parseDate(userText);
            if (!parsedDate) {
              await replyLineMessage(replyToken, "❌ รูปแบบวันที่ไม่ถูกต้อง กรุณาพิมพ์แค่ตัวเลข (เช่น 18) หรือพิมพ์ 'วันนี้'");
              continue;
            }
            draft.date = parsedDate;
            await supabase.from('bot_states').update({ current_step: 'WAITING_ITEMS', draft_data: draft }).eq('line_user_id', lineUserId);
            await replyLineMessage(replyToken, `วันที่: ${parsedDate}\n\nกรุณาพิมพ์ **รายการสินค้า จำนวนชิ้น (และราคาชุดละ)**\nเช่น 'ขนมชั้น 15 35' หรือ 'ตะโก้ 10'\n(หากเพิ่มครบแล้ว พิมพ์คำว่า **พอแล้ว**)`);
          
          } else if (step === 'WAITING_ITEMS') {
            if (userText === 'พอแล้ว') {
              if (draft.items.length === 0) {
                await replyLineMessage(replyToken, "ยังไม่มีรายการสินค้าเลยครับ กรุณาเพิ่มสินค้าก่อน หรือพิมพ์ 'ยกเลิก'");
                continue;
              }
              const totalAmount = draft.items.reduce((sum: number, item: any) => sum + item.amount, 0);
              draft.totalAmount = totalAmount;
              await supabase.from('bot_states').update({ current_step: 'CONFIRM', draft_data: draft }).eq('line_user_id', lineUserId);
              
              let summaryMsg = `🧾 **สรุปบิล**\nลูกค้า: ${draft.customerName}\nวันที่: ${draft.date}\n\n`;
              draft.items.forEach((it: any, idx: number) => {
                summaryMsg += `${idx+1}. ${it.description} x${it.quantity} (${it.amount} บ.)\n`;
              });
              summaryMsg += `\nยอดรวม: **${totalAmount} บาท**\n\nยืนยันการบันทึกหรือไม่?\n(พิมพ์ **ยืนยัน** หรือ **ยกเลิก**)`;
              
              await replyLineMessage(replyToken, summaryMsg);
            } else {
              const item = parseItem(userText);
              if (!item) {
                await replyLineMessage(replyToken, "❌ รูปแบบไม่ถูกต้อง\nกรุณาพิมพ์ ชื่อสินค้า เว้นวรรค จำนวน เว้นวรรค ราคา\nเช่น 'ขนมชั้น 15 35'");
                continue;
              }
              if (!draft.items) draft.items = [];
              draft.items.push(item);
              await supabase.from('bot_states').update({ draft_data: draft }).eq('line_user_id', lineUserId);
              await replyLineMessage(replyToken, `✅ เพิ่ม ${item.description} จำนวน ${item.quantity} เรียบร้อย\n\nมีรายการอื่นอีกไหมครับ?\n(พิมพ์รายการต่อได้เลย หรือพิมพ์ **พอแล้ว** เพื่อสรุปยอด)`);
            }

          } else if (step === 'CONFIRM') {
            if (userText === 'ยืนยัน') {
              // Save to DB
              const invoiceId = Date.now();
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

              const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
              if (itemsError) throw itemsError;

              // Clear state
              await supabase.from('bot_states').delete().eq('line_user_id', lineUserId);
              
              // Build Flex Message
              const itemBoxes = draft.items.map((it: any) => ({
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: `${it.description} x${it.quantity}`, size: "sm", color: "#555555", flex: 0 },
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
            } else {
              await replyLineMessage(replyToken, "พิมพ์ **ยืนยัน** เพื่อบันทึก หรือ **ยกเลิก** เพื่อลบข้อมูลบิลนี้ครับ");
            }
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
