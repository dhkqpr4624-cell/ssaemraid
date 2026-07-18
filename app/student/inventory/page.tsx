'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Package,
  Shirt,
  Home,
  Star,
  Zap,
  LogOut,
} from 'lucide-react';
import {
  getStudentSession,
  clearStudentSession,
} from '@/lib/class-storage';
import { findStudent } from '@/lib/db-wrapper';
import type { Student, Item, ItemType } from '@/lib/types';

function InventoryContent() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [selectedTab, setSelectedTab] = useState<ItemType>('avatar');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudent = async () => {
      const session = getStudentSession();
      if (!session) {
        router.push('/student');
        return;
      }

      try {
        const result = await findStudent(session.classCode, session.attendanceNumber);
        if (result.success && result.student) {
          setStudent(result.student);
        } else {
          router.push('/student');
        }
      } catch (err) {
        console.error('학생 정보 로드 오류:', err);
        router.push('/student');
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [router]);

  const handleLogout = () => {
    clearStudentSession();
    router.push('/student');
  };

  if (loading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">📦</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">학생 정보를 찾을 수 없습니다.</p>
          <Button onClick={() => router.push('/student/dashboard')}>돌아가기</Button>
        </div>
      </main>
    );
  }

  const itemsByType = {
    avatar: student.items.filter(i => i.type === 'avatar'),
    room: student.items.filter(i => i.type === 'room'),
    badge: student.items.filter(i => i.type === 'badge'),
    decoration: student.items.filter(i => i.type === 'decoration'),
    etc: student.items.filter(i => i.type === 'etc'),
  };

  const getEquippedItemId = (type: ItemType): string | undefined => {
    if (type === 'avatar') {
      return Object.values(student.avatarState?.equipped ?? {}).find(() => true);
    }
    if (type === 'room') {
      return Object.values(student.roomState?.equipped ?? {}).find(() => true);
    }
    return undefined;
  };

  const renderItem = (item: Item) => {
    const isEquipped = getEquippedItemId(item.type) === item.id;
    
    return (
      <Card key={item.id} className={`relative overflow-hidden transition-all ${isEquipped ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl">{item.emoji}</span>
              )}
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">{item.name}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {item.rarity || 'common'}
              </Badge>
            </div>
            {isEquipped && (
              <Badge className="w-full justify-center">
                <Star className="w-3 h-3 mr-1" />
                장착중
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              돌아가기
            </Link>
            <h1 className="text-3xl font-bold">내 아이템</h1>
          </div>
          <Button variant="outline" onClick={handleLogout} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>

        {/* 아이템 탭 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              아이템 목록
            </CardTitle>
            <CardDescription>
              총 {student.items.length}개의 아이템 보유
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as ItemType)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="avatar" className="flex items-center gap-1">
                  <Shirt className="w-4 h-4" />
                  <span className="hidden sm:inline">아바타</span>
                  <span className="sm:hidden text-xs">{itemsByType.avatar.length}</span>
                </TabsTrigger>
                <TabsTrigger value="room" className="flex items-center gap-1">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">방</span>
                  <span className="sm:hidden text-xs">{itemsByType.room.length}</span>
                </TabsTrigger>
                <TabsTrigger value="badge" className="flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  <span className="hidden sm:inline">배지</span>
                  <span className="sm:hidden text-xs">{itemsByType.badge.length}</span>
                </TabsTrigger>
                <TabsTrigger value="decoration" className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  <span className="hidden sm:inline">장식</span>
                  <span className="sm:hidden text-xs">{itemsByType.decoration.length}</span>
                </TabsTrigger>
                <TabsTrigger value="etc" className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span className="hidden sm:inline">기타</span>
                  <span className="sm:hidden text-xs">{itemsByType.etc.length}</span>
                </TabsTrigger>
              </TabsList>

              {Object.entries(itemsByType).map(([type, items]) => (
                <TabsContent key={type} value={type as ItemType} className="space-y-4">
                  {items.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">아이템이 없습니다</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {items.map(renderItem)}
                      </div>

                      {/* 카테고리별 액션 버튼 */}
                      <div className="pt-4 border-t">
                        {type === 'avatar' && itemsByType.avatar.length > 0 && (
                          <Link href="/student/avatar">
                            <Button className="w-full">
                              <Shirt className="w-4 h-4 mr-2" />
                              아바타 꾸미기
                            </Button>
                          </Link>
                        )}
                        {type === 'room' && itemsByType.room.length > 0 && (
                          <Link href="/student/room">
                            <Button className="w-full">
                              <Home className="w-4 h-4 mr-2" />
                              방 꾸미기
                            </Button>
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">📦</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    }>
      <InventoryContent />
    </Suspense>
  );
}
