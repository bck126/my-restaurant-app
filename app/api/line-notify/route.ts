import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { table, orderType, customerContact, items, totalPrice } = await req.json();

    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const targetId = process.env.LINE_TARGET_ID;

    if (!channelAccessToken || !targetId) {
      return NextResponse.json({ error: 'Missing LINE Token or Target ID' }, { status: 500 });
    }

    // จัดข้อความรายการอาหาร
    const itemDetails = items
      .map((item: any) => {
        let text = `- ${item.name} x${item.quantity}`;
        if (item.selectedAddons && item.selectedAddons.length > 0) {
          text += ` (${item.selectedAddons.map((a: any) => a.name).join(', ')})`;
        }
        if (item.note) {
          text += ` [โน้ต: ${item.note}]`;
        }
        return text;
      })
      .join('\n');

    const messageText = `🔔 มีออเดอร์ใหม่เข้าครัว!\n📌 โต๊ะ/ประเภท: โต๊ะ ${table} (${orderType})${
      customerContact ? `\n👤 ติดต่อ: ${customerContact}` : ''
    }\n------------------\n📋 รายการอาหาร:\n${itemDetails}\n------------------\n💰 ราคารวม: ฿${totalPrice}\n⚠️ กรุณาตรวจสอบและเริ่มทำอาหาร!`;

    // ยิง Push Message ผ่าน LINE API
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: [{ type: 'text', text: messageText }],
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('LINE API Error:', errorData);
      return NextResponse.json({ error: errorData }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in line-notify route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}