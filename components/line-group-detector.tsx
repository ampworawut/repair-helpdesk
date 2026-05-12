'use client'

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { MessageCircle, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LineGroupDetector() {
  const [detectedGroupId, setDetectedGroupId] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const startDetection = async () => {
    setIsDetecting(true);
    setDetectedGroupId('');
    setCopied(false);

    try {
      // Simulate detection - in real implementation, this would listen for webhook events
      // For now, we'll show instructions and let users manually enter the group ID
      toast.info(
        <div className="space-y-2">
          <p className="font-medium">วิธีการตรวจจับ Group ID</p>
          <ol className="text-sm list-decimal list-inside space-y-1">
            <li>เพิ่ม @repairdesk_bot เข้ากลุ่ม LINE ที่ต้องการ</li>
            <li>ส่งข้อความใดๆ ในกลุ่ม (เช่น "test")</li>
            <li>บอทจะตอบกลับด้วย Group ID ของกลุ่ม</li>
            <li>คัดลอก Group ID มาใส่ในฟอร์มด้านล่าง</li>
          </ol>
        </div>,
        { duration: 10000 }
      );

      // Listen for recent webhook events (simplified version)
      // In a real implementation, you'd have a proper webhook listener
      setTimeout(() => {
        setIsDetecting(false);
        toast.info('ตรวจสอบกล่องข้อความ LINE ของคุณสำหรับ Group ID');
      }, 3000);

    } catch (error) {
      console.error('Detection error:', error);
      toast.error('การตรวจจับล้มเหลว');
      setIsDetecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('คัดลอกแล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="bg-blue-100 p-3 rounded-lg">
          <MessageCircle className="w-6 h-6 text-blue-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-2">ตรวจจับ LINE Group ID อัตโนมัติ</h3>
          <p className="text-blue-700 text-sm mb-4">
            ใช้เครื่องมือนี้เพื่อตรวจจับ Group ID ของกลุ่ม LINE โดยอัตโนมัติ
          </p>

          <div className="space-y-4">
            <button
              onClick={startDetection}
              disabled={isDetecting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <MessageCircle className="w-4 h-4" />
              {isDetecting ? 'กำลังตรวจจับ...' : 'เริ่มตรวจจับ Group ID'}
            </button>

            {detectedGroupId && (
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Group ID ที่ตรวจจับได้:</span>
                  <button
                    onClick={() => copyToClipboard(detectedGroupId)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                  </button>
                </div>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono break-all">
                  {detectedGroupId}
                </code>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-yellow-700 text-xs">
                  <p className="font-medium">หมายเหตุ:</p>
                  <p>คุณต้องเพิ่ม @repairdesk_bot เข้ากลุ่ม LINE ก่อนการตรวจจับ</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}