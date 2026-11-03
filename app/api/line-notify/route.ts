import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, orderType, items, totalPrice, customerContact } = body;

    // จัดรูปแบบข้อความรายการอาหาร
    const messageList = items
      .map((item: any) => {
        const addonsText = item.selectedAddons?.length
          ? ` (+${item.selectedAddons.map((a: any) => a.name).join(', ')})`
          : '';
        const noteText = item.note ? ` [โน้ต: ${item.note}]` : '';
        return `• ${item.name} x${item.quantity}${addonsText}${noteText}`;
      })
      .join('\n');

    const messageText = 
`🔔 มีออเดอร์ใหม่เข้าครัว!
--------------------------
📌 โต๊ะ/ประเภท: โต๊ะ ${table} (${orderType})
${customerContact ? `👤 ลูกค้า: ${customerContact}\n` : ''}
📋 รายการอาหาร:
${messageList}

💰 ราคารวม: ฿${totalPrice}
--------------------------
⚠️ กรุณาตรวจสอบและเริ่มทำอาหาร!`;

    // ยิง API ไปหา LINE Messaging API
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: process.env.LINE_TARGET_ID,
        messages: [{ type: 'text', text: messageText }],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('LINE API Error:', errorData);
      return NextResponse.json({ error: 'Failed to send LINE notification' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Line Notification Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}