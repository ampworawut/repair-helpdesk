'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { MessageCircle, Copy, CheckCircle, AlertCircle, Radio } from 'lucide-react';
import { toast } from 'sonner';

export default function LineGroupListener() {
  const [detectedGroups, setDetectedGroups] = useState<Array<{groupId: string; timestamp: Date}>>([]);
  const [isListening, setIsListening] = useState(false);
  const [copiedGroupId, setCopiedGroupId] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (!isListening) return;

    // Real-time listener using Supabase Realtime
    const channel = supabase
      .channel('line-webhook-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'line_webhook_logs',
      }, (payload) => {
        const newRecord = payload.new;
        if (newRecord.group_id) {
          const newGroup = {
            groupId: newRecord.group_id,
            timestamp: new Date(newRecord.received_at)
          };

          setDetectedGroups(prev => {
            const existingIds = new Set(prev.map(g => g.groupId));
            if (!existingIds.has(newGroup.groupId)) {
              return [newGroup, ...prev].slice(0, 10);
            }
            return prev;
          });

          // Mark as processed
          supabase
            .from('line_webhook_logs')
            .update({ processed: true })
            .eq('id', newRecord.id)
            .then(() => console.log('Marked webhook log as processed'));
        }
      })
      .subscribe();

    // Also load recent unprocessed events on start
    const loadRecentEvents = async () => {
      try {
        const { data: recentActivities } = await supabase
          .from('line_webhook_logs')
          .select('group_id, received_at')
          .eq('processed', false)
          .order('received_at', { ascending: false })
          .limit(10);

        if (recentActivities && recentActivities.length > 0) {
          const newGroups = recentActivities
            .filter(activity => activity.group_id)
            .map(activity => ({
              groupId: activity.group_id,
              timestamp: new Date(activity.received_at)
            }));

          setDetectedGroups(prev => {
            const existingIds = new Set(prev.map(g => g.groupId));
            const uniqueNewGroups = newGroups.filter(g => !existingIds.has(g.groupId));
            return [...uniqueNewGroups, ...prev].slice(0, 10);
          });

          // Mark all as processed
          await supabase
            .from('line_webhook_logs')
            .update({ processed: true })
            .eq('processed', false);
        }
      } catch (error) {
        console.error('Error loading recent events:', error);
      }
    };

    loadRecentEvents();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isListening, supabase]);

  const startListening = () => {
    setIsListening(true);
    setDetectedGroups([]);
    toast.info(
      <div className="space-y-2">
        <p className="font-medium">กำลังฟังการตรวจจับ Group ID</p>
        <p className="text-sm"><strong>ขั้นตอน:</strong></p>
        <ol className="text-sm list-decimal list-inside space-y-1">
          <li>เพิ่ม @repairdesk_bot เข้ากลุ่ม LINE</li>
          <li>ส่งข้อความใดๆ ในกลุ่ม (เช่น "test")</li>
          <li>ระบบจะตรวจจับ Group ID อัตโนมัติ</li>
        </ol>
      </div>,
      { duration: 8000 }
    );
  };

  const stopListening = () => {
    setIsListening(false);
    toast.info('หยุดการฟังการตรวจจับแล้ว');
  };

  const copyToClipboard = (groupId: string) => {
    navigator.clipboard.writeText(groupId);
    setCopiedGroupId(groupId);
    toast.success('คัดลอก Group ID แล้ว');
    setTimeout(() => setCopiedGroupId(''), 2000);
  };

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Radio className="w-6 h-6 text-blue-600" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-2">ระบบตรวจจับ LINE Group ID แบบเรียลไทม์</h3>
          <p className="text-blue-700 text-sm mb-4">
            ฟังและตรวจจับ Group ID จากกลุ่ม LINE ที่เพิ่มบอทใหม่
          </p>

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={isListening ? stopListening : startListening}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  isListening 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Radio className="w-4 h-4" />
                {isListening ? 'หยุดการฟัง' : 'เริ่มฟังการตรวจจับ'}
              </button>

              {isListening && (
                <div className="flex items-center gap-2 px-3 bg-blue-100 text-blue-700 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm">กำลังฟัง...</span>
                </div>
              )}
            </div>

            {detectedGroups.length > 0 && (
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-3">Group ID ที่ตรวจจับได้:</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detectedGroups.map((group, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <code className="text-sm font-mono break-all">{group.groupId}</code>
                        <div className="text-xs text-gray-500">{formatTime(group.timestamp)}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(group.groupId)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm px-2 py-1"
                      >
                        {copiedGroupId === group.groupId ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        คัดลอก
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-yellow-700 text-xs">
                  <p className="font-medium">หมายเหตุ:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>ต้องเพิ่ม @repairdesk_bot เข้ากลุ่ม LINE ก่อน</li>
                    <li>ส่งข้อความในกลุ่มเพื่อ激活การตรวจจับ</li>
                    <li>ระบบจะบันทึก Group ID อัตโนมัติ</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}