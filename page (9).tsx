'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Sparkles, Check, X, Palette, Shirt, User as UserIcon } from 'lucide-react';
import { getStudentSession } from '@/lib/class-storage';
import { findStudent, saveStudentAvatarState } from '@/lib/db-wrapper';
import { SpriteAvatarRenderer, SpriteItemIcon } from '@/components/avatar/AvatarRenderer';
import { AVATAR_CUSTOMIZATION_OPTIONS, DEFAULT_AVATAR_COLORS } from '@/lib/avatar-assets';
import { ensureDefaultAvatarItems, ensureDefaultAvatarState, DEFAULT_AVATAR_ITEM_IDS } from '@/lib/default-avatar-items';
import type { Student, Item, AvatarState, AvatarSlot } from '@/lib/types';

const SLOT_LABELS: Record<string, string> = {
  all: '전체',
  cape: '망토',
  hair: '머리',
  eyes: '눈',
  eyebrow: '눈썹',
  mouth: '입',
  face: '얼굴',
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  hat: '모자',
  accessory: '장신구',
  pet: '펫',
  background: '배경',
};

// 해제 불가 슬롯 (eyes는 항상 최소 1개 장착)
const NON_REMOVABLE_SLOTS: AvatarSlot[] = ['eyes'];

// 해제 가능 슬롯
const REMOVABLE_SLOTS: AvatarSlot[] = ['hair', 'eyebrow', 'mouth'];

/**
 * 스프라이트 시트 아이템 아이콘 표시 (첫 프레임만)
 * imageUrl이 있으면 SpriteItemIcon, 없으면 emoji
 */
function ItemIcon({ item, size = 48, eyeColor, hairColor }: { item: Item; size?: number; eyeColor?: string; hairColor?: string }) {
  if (item.imageUrl) {
    const tintColor = item.slot === 'eyes' ? eyeColor : item.slot === 'hair' ? hairColor : undefined;
    return (
      <SpriteItemIcon
        imageUrl={item.imageUrl}
        tintMaskUrl={item.tintMaskUrl}
        overlayImageUrl={item.overlayImageUrl}
        hairLayerMode={item.hairLayerMode}
        shadowImageUrl={item.shadowImageUrl}
        outlineImageUrl={item.outlineImageUrl}
        tintColor={tintColor}
        size={size}
        className="rounded"
      />
    );
  }
  return (
    <span style={{ fontSize: size * 0.5 }}>{item.icon || '?'}</span>
  );
}

/**
 * Color Picker 컴포넌트
 */
function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium w-16 shrink-0">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-9 h-9 rounded-full border-2 border-muted-foreground/30 hover:border-primary transition-all shadow-sm"
          style={{ backgroundColor: value }}
          title={`${label} 선택: ${value}`}
        />
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-label={`${label} 색상 선택`}
        />
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
      </div>
    </div>
  );
}

function AvatarCustomizationContent() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<AvatarState | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudent = async () => {
      const session = getStudentSession();
      if (!session) {
        router.push('/student');
        return;
      }

      try {
        const result = await findStudent(session.classCode, session.attendanceNumber);
        if (!result.success || !result.student) {
          router.push('/student');
          return;
        }

        const normalizedStudent = {
          ...result.student,
          items: ensureDefaultAvatarItems(result.student.items),
          avatarState: ensureDefaultAvatarState(result.student.avatarState),
        };
        setStudent(normalizedStudent);
        setCurrentAvatar(normalizedStudent.avatarState);
      } catch (err) {
        console.error('학생 정보 로드 오류:', err);
        router.push('/student');
      } finally {
        setIsLoading(false);
      }
    };

    loadStudent();
  }, [router]);

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">👕</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    );
  }

  if (!student || !currentAvatar) {
    return (
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">학생 정보를 찾을 수 없습니다.</p>
          <Button onClick={() => router.push('/student/dashboard')}>돌아가기</Button>
        </div>
      </main>
    );
  }

  // 아바타 아이템만 필터링
  const avatarItems = student.items.filter(item => item.type === 'avatar');
  const filteredItems = selectedSlot === 'all'
    ? avatarItems
    : avatarItems.filter(item => item.slot === selectedSlot);

  // 슬롯이 해제 가능한지 확인
  const isRemovable = (slot: AvatarSlot | string): boolean => {
    return REMOVABLE_SLOTS.includes(slot as AvatarSlot);
  };

  // 슬롯이 해제 불가인지 확인
  const isNonRemovable = (slot: AvatarSlot | string): boolean => {
    return NON_REMOVABLE_SLOTS.includes(slot as AvatarSlot);
  };

  const handleEquip = (item: Item) => {
    if (!item.slot) return;
    setCurrentAvatar(prev => ({
      ...prev!,
      equipped: {
        ...prev!.equipped,
        [item.slot!]: item.id,
      },
    }));
  };

  const handleUnequip = (slot: AvatarSlot) => {
    // eyes는 해제 불가
    if (isNonRemovable(slot)) return;

    setCurrentAvatar(prev => {
      const newEquipped = { ...prev!.equipped };
      // undefined/delete로 저장하면 기존 학생 데이터 보정 과정에서 기본 아이템이 다시 장착될 수 있습니다.
      // null은 "사용자가 의도적으로 해제함"이라는 표시로 저장하고,
      // ensureDefaultAvatarState에서 렌더링용 equipped에서는 제거됩니다.
      (newEquipped as any)[slot] = null;
      return {
        ...prev!,
        equipped: newEquipped,
      };
    });
  };

  const handleSkinColorChange = (color: string) => {
    setCurrentAvatar(prev => ({ ...prev!, skinColor: color }));
  };

  const handleEyeColorChange = (color: string) => {
    setCurrentAvatar(prev => ({ ...prev!, eyeColor: color }));
  };

  const handleHairColorChange = (color: string) => {
    setCurrentAvatar(prev => ({ ...prev!, hairColor: color }));
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      const session = getStudentSession();
      if (session && student) {
        saveStudentAvatarState(session.classCode, session.attendanceNumber, currentAvatar!, student.items)
          .then(() => {
            setIsSaving(false);
            router.push('/student/dashboard');
          })
          .catch(err => {
            console.error('저장 오류:', err);
            setIsSaving(false);
          });
      }
    } catch (err) {
      console.error('저장 오류:', err);
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    router.push('/student/dashboard');
  };

  // 현재 슬롯에 아이템이 장착되어 있는지
  const isEquipped = (item: Item): boolean => {
    if (!item.slot) return false;
    return currentAvatar?.equipped?.[item.slot as AvatarSlot] === item.id;
  };

  // 아이템 카드 렌더링 (공통)
  const renderItemCard = (item: Item) => {
    const equipped = isEquipped(item);
    const slot = item.slot as AvatarSlot;
    const canUnequip = equipped && isRemovable(slot);
    const noUnequipButton = equipped && isNonRemovable(slot);

    return (
      <div
        key={item.id}
        className={`rounded-lg border-2 p-2 space-y-2 transition-all ${
          equipped
            ? 'border-primary bg-primary/5'
            : 'border-muted hover:border-muted-foreground/40'
        }`}
      >
        {/* 아이템 아이콘 - 첫 프레임만 표시 */}
        <div className="aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden relative">
          {item.imageUrl ? (
            <SpriteItemIcon
              imageUrl={item.imageUrl}
              tintMaskUrl={item.tintMaskUrl}
              overlayImageUrl={item.overlayImageUrl}
              hairLayerMode={item.hairLayerMode}
              shadowImageUrl={item.shadowImageUrl}
              outlineImageUrl={item.outlineImageUrl}
              tintColor={item.slot === 'eyes' ? currentAvatar?.eyeColor : item.slot === 'hair' ? currentAvatar?.hairColor : undefined}
              size={84}
            />
          ) : (
            <span className="text-2xl">{item.icon || '?'}</span>
          )}
          {equipped && (
            <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* 아이템 이름 */}
        <div className="space-y-0.5">
          <p className="text-xs font-medium truncate leading-tight">{item.name}</p>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {SLOT_LABELS[item.slot || 'all'] || item.slot}
          </Badge>
        </div>

        {/* 장착/해제 버튼 */}
        <div className="space-y-1">
          {equipped ? (
            <>
              {/* 장착 중 표시 (눈은 해제 버튼 없음) */}
              {noUnequipButton ? (
                <div className="w-full text-center text-xs text-primary font-medium py-1 bg-primary/10 rounded">
                  <Check className="w-3 h-3 inline mr-1" />
                  장착됨
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnequip(slot)}
                  className="w-full text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <X className="w-3 h-3 mr-1" />
                  장착 해제
                </Button>
              )}
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEquip(item)}
              className="w-full text-xs h-7"
            >
              장착
            </Button>
          )}
        </div>
      </div>
    );
  };

  // 특정 슬롯에 "없음" 슬롯 표시 (해제 가능 슬롯에만)
  const renderNoneSlot = (slot: string) => {
    if (!isRemovable(slot)) return null;
    const isNoneSelected = !currentAvatar?.equipped?.[slot as AvatarSlot];

    return (
      <div
        key={`none-${slot}`}
        className={`rounded-lg border-2 p-2 space-y-2 transition-all ${
          isNoneSelected
            ? 'border-primary bg-primary/5'
            : 'border-muted hover:border-muted-foreground/40'
        }`}
      >
        <div className="aspect-square bg-muted rounded-md flex items-center justify-center">
          <span className="text-2xl text-muted-foreground">✕</span>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-medium truncate leading-tight">없음</p>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {SLOT_LABELS[slot] || slot}
          </Badge>
        </div>
        <Button
          size="sm"
          variant={isNoneSelected ? 'default' : 'outline'}
          onClick={() => handleUnequip(slot as AvatarSlot)}
          className="w-full text-xs h-7"
          disabled={isNoneSelected}
        >
          {isNoneSelected ? (
            <>
              <Check className="w-3 h-3 mr-1" />
              선택됨
            </>
          ) : (
            '해제'
          )}
        </Button>
      </div>
    );
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              돌아가기
            </button>
            <h1 className="text-3xl font-bold">아바타 꾸미기</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 아바타 미리보기 */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  미리보기
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <SpriteAvatarRenderer
                    avatarState={currentAvatar}
                    inventory={student.items}
                    hairColor={currentAvatar.hairColor}
                  />
                </div>

                {/* 현재 장착 요약 */}
                <div className="w-full text-xs text-muted-foreground space-y-1">
                  {(['hair', 'eyes', 'eyebrow', 'mouth'] as AvatarSlot[]).map(slot => {
                    const itemId = currentAvatar?.equipped?.[slot];
                    const item = itemId ? student.items.find(i => i.id === itemId) : null;
                    return (
                      <div key={slot} className="flex justify-between">
                        <span>{SLOT_LABELS[slot]}:</span>
                        <span className={item ? 'text-foreground' : 'text-muted-foreground/50'}>
                          {item ? item.name : '없음'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 커스터마이징 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 색상 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-primary" />
                  색상 선택
                </CardTitle>
                <CardDescription>색상 원을 클릭하여 자유롭게 색상을 선택하세요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorPicker
                  label="피부색"
                  value={currentAvatar.skinColor || DEFAULT_AVATAR_COLORS.skinColor}
                  onChange={handleSkinColorChange}
                />
                <ColorPicker
                  label="눈색"
                  value={currentAvatar.eyeColor || DEFAULT_AVATAR_COLORS.eyeColor}
                  onChange={handleEyeColorChange}
                />
                <ColorPicker
                  label="머리색"
                  value={currentAvatar.hairColor || DEFAULT_AVATAR_COLORS.hairColor}
                  onChange={handleHairColorChange}
                />
              </CardContent>
            </Card>

            {/* 아이템 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="w-5 h-5 text-primary" />
                  아이템 선택
                </CardTitle>
                <CardDescription>
                  보유한 아바타 아이템을 장착하세요. 눈은 항상 장착 상태를 유지합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {avatarItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">아이템이 없습니다</p>
                  </div>
                ) : (
                  <Tabs defaultValue="all" onValueChange={setSelectedSlot}>
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 mb-6 h-auto">
                      {Object.entries(SLOT_LABELS).map(([key, label]) => (
                        <TabsTrigger key={key} value={key} className="text-xs">
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {Object.keys(SLOT_LABELS).map(slot => {
                      const items = slot === 'all' ? avatarItems : avatarItems.filter(item => item.slot === slot);

                      return (
                        <TabsContent key={slot} value={slot} className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {/* 해제 가능 슬롯에는 "없음" 슬롯 표시 */}
                            {slot !== 'all' && renderNoneSlot(slot)}

                            {items.map(item => renderItemCard(item))}

                            {items.length === 0 && slot !== 'all' && (
                              <div className="col-span-full text-center py-4 text-muted-foreground text-sm">
                                이 슬롯에 보유한 아이템이 없습니다
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )}
              </CardContent>
            </Card>

            {/* 저장 버튼 */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleBack} disabled={isSaving}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                취소
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <>
                    <div className="animate-spin mr-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    저장하기
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AvatarPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4 text-4xl">👕</div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </main>
    }>
      <AvatarCustomizationContent />
    </Suspense>
  );
}
