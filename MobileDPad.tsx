'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, GripVertical, CheckCircle2, Circle, Image as ImageIcon, X, Search } from 'lucide-react';
import type { QuestionType, QuizRewardOption, ItemType, AvatarSlot } from '@/lib/types';
import { getAllRoomItems, searchRoomItems, getRoomItemFrameStyle, getRoomItemById } from '@/lib/room-items-registry';
import { getCustomItems, importCustomItem, searchCustomItems } from '@/lib/custom-items';
import { getRewardFolderItems } from '@/lib/reward-folder-items';
import {
  REWARD_GRADE_OPTIONS,
  REWARD_SEMESTER_OPTIONS,
  getRewardSubjectsForGrade,
  getRewardUnits,
  matchesRewardCategoryFilter,
} from '@/lib/reward-categories';

// --- 문항 편집 컴포넌트 ---

export interface QuestionDraft {
  type: QuestionType;
  text: string;
  points: number;
  options: string[];
  correctAnswers: number[];
  shortAnswers: string[];
  hint: string;
}

export const defaultQuestion = (): QuestionDraft => ({
  type: 'single',
  text: '',
  points: 10,
  options: ['', '', '', ''],
  correctAnswers: [],
  shortAnswers: [''],
  hint: '',
});

const typeLabels: Record<QuestionType, string> = {
  single: '객관식 (단일정답)',
  multiple: '객관식 (복수정답)',
  short: '단답형',
  essay: '장문형',
};

const typeBadgeColors: Record<QuestionType, string> = {
  single: 'bg-blue-100 text-blue-700',
  multiple: 'bg-purple-100 text-purple-700',
  short: 'bg-green-100 text-green-700',
  essay: 'bg-orange-100 text-orange-700',
};

interface QuestionEditorProps {
  index: number;
  question: QuestionDraft;
  onChange: (updated: QuestionDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function QuestionItemEditor({
  index,
  question,
  onChange,
  onRemove,
  canRemove,
}: QuestionEditorProps) {
  const update = (patch: Partial<QuestionDraft>) => onChange({ ...question, ...patch });

  const setOption = (i: number, value: string) => {
    const options = [...question.options];
    options[i] = value;
    update({ options });
  };

  const addOption = () => {
    if (question.options.length >= 6) return;
    update({ options: [...question.options, ''] });
  };

  const removeOption = (i: number) => {
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, idx) => idx !== i);
    const correctAnswers = question.correctAnswers
      .filter(c => c !== i)
      .map(c => (c > i ? c - 1 : c));
    update({ options, correctAnswers });
  };

  const setSingleAnswer = (i: number) => {
    update({ correctAnswers: [i] });
  };

  const toggleMultipleAnswer = (i: number) => {
    const set = new Set(question.correctAnswers);
    if (set.has(i)) set.delete(i);
    else set.add(i);
    update({ correctAnswers: Array.from(set) });
  };

  const setShortAnswer = (i: number, value: string) => {
    const shortAnswers = [...question.shortAnswers];
    shortAnswers[i] = value;
    update({ shortAnswers });
  };

  const addShortAnswer = () => {
    if (question.shortAnswers.length >= 5) return;
    update({ shortAnswers: [...question.shortAnswers, ''] });
  };

  const removeShortAnswer = (i: number) => {
    if (question.shortAnswers.length <= 1) return;
    update({ shortAnswers: question.shortAnswers.filter((_, idx) => idx !== i) });
  };

  const changeType = (type: QuestionType) => {
    update({
      type,
      options: type === 'single' || type === 'multiple' ? ['', '', '', ''] : [],
      correctAnswers: [],
      shortAnswers: type === 'short' ? [''] : [],
    });
  };

  return (
    <Card className="border-2 border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 mt-0.5 text-muted-foreground cursor-grab">
            <GripVertical className="w-4 h-4" />
            <span className="font-bold text-foreground text-sm">문항 {index + 1}</span>
          </div>

          <div className="flex-1 flex flex-wrap items-center gap-2">
            <Select value={question.type} onValueChange={v => changeType(v as QuestionType)}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(typeLabels) as QuestionType[]).map(t => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadgeColors[question.type]}`}>
              {typeLabels[question.type]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={100}
                value={question.points}
                onChange={e => update({ points: parseInt(e.target.value) || 1 })}
                className="w-16 h-8 text-sm text-center"
              />
              <span className="text-sm text-muted-foreground">점</span>
            </div>
            {canRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">문항 내용</Label>
          <Textarea
            placeholder="문항 내용을 입력하세요..."
            value={question.text}
            onChange={e => update({ text: e.target.value })}
            rows={2}
            className="resize-none"
          />
        </div>

        {(question.type === 'single' || question.type === 'multiple') && (
          <div>
            <Label className="text-sm font-medium mb-2 block">
              보기 및 정답 선택
            </Label>
            <div className="space-y-2">
              {question.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {question.type === 'single' ? (
                    <button
                      type="button"
                      onClick={() => setSingleAnswer(i)}
                      className="flex-shrink-0"
                    >
                      {question.correctAnswers[0] === i ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/50" />
                      )}
                    </button>
                  ) : (
                    <Checkbox
                      checked={question.correctAnswers.includes(i)}
                      onCheckedChange={() => toggleMultipleAnswer(i)}
                      className="flex-shrink-0"
                    />
                  )}
                  <span className="text-sm text-muted-foreground w-5 flex-shrink-0">
                    {String.fromCharCode(9312 + i)}
                  </span>
                  <Input
                    placeholder={`보기 ${i + 1}`}
                    value={opt}
                    onChange={e => setOption(i, e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  {question.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(i)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {question.options.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="mt-2 h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                보기 추가
              </Button>
            )}
          </div>
        )}

        {question.type === 'short' && (
          <div>
            <Label className="text-sm font-medium mb-1.5 block">
              정답 키워드
            </Label>
            <div className="space-y-2">
              {question.shortAnswers.map((ans, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`정답 키워드 ${i + 1}`}
                    value={ans}
                    onChange={e => setShortAnswer(i, e.target.value)}
                    className="flex-1 h-8 text-sm"
                  />
                  {question.shortAnswers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShortAnswer(i)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {question.shortAnswers.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addShortAnswer}
                className="mt-2 h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                정답 추가
              </Button>
            )}
          </div>
        )}

        {question.type === 'essay' && (
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
            <p className="text-sm text-orange-700">
              장문형 문항은 학생이 자유롭게 서술하며, 교사가 직접 채점합니다.
            </p>
          </div>
        )}

        <div>
          <Label className="text-sm font-medium mb-1.5 block">
            힌트 <span className="text-xs text-muted-foreground">(선택)</span>
          </Label>
          <Input
            placeholder="학생에게 보여줄 힌트를 입력하세요..."
            value={question.hint}
            onChange={e => update({ hint: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- 보상 편집 컴포넌트 ---

export interface RewardDraft {
  id?: string;
  itemId?: string;
  requiredScore: number;
  itemName: string;
  itemIcon: string;
  itemImageUrl?: string;
  itemSpriteUrl?: string;
  itemType: ItemType;
  itemSlot?: AvatarSlot;
  itemDescription: string;

  // item-editor 제작 room item metadata.
  // 퀴즈 저장 시 이 값이 빠지면 320x160/320x320 제작 가구가
  // 학생 방에서 1칸 가구처럼 축소됩니다.
  roomSize?: '160x160' | '320x160' | '320x320' | string;
  spriteConfig?: { columns: number; rows: number; frameWidth: number; frameHeight: number };
  directionImages?: Record<string, string>;
  availableDirections?: string[];
  defaultDirection?: string;
  footprint?: { w?: number; h?: number; width?: number; height?: number };
  curriculum?: { grade?: string; semester?: string; subject?: string; unit?: string };

  // item-editor 제작 avatar hair item metadata.
  // 3레이어 머리카락 보상이 학생 인벤토리로 들어갈 때 구조가 사라지지 않도록 보존합니다.
  hairLayerMode?: 'singleColorMask' | 'triple' | 'six';
  tintMaskUrl?: string;
  shadowImageUrl?: string;
  outlineImageUrl?: string;
  overlayImageUrl?: string;

  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
}

export const defaultReward = (): RewardDraft => ({
  requiredScore: 0,
  itemName: '',
  itemIcon: '🎁',
  itemType: 'badge',
  itemDescription: '',
});

interface RewardEditorProps {
  index: number;
  reward: RewardDraft;
  onChange: (updated: RewardDraft) => void;
  onRemove: () => void;
}

export function RewardItemEditor({
  index,
  reward,
  onChange,
  onRemove,
}: RewardEditorProps) {
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState({ grade: '', semester: '', subject: '', unit: '' });
  const update = (patch: Partial<RewardDraft>) => onChange({ ...reward, ...patch });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      update({ itemImageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  // 기존 아이템 검색 및 선택
  const handleSelectExistingItem = (item: any) => {
    update({
      itemId: item.id,
      itemName: item.name,
      itemIcon: item.icon || '🎁',
      // itemImageUrl은 보상 선택/수령/인벤토리 카드에서 보일 아이콘입니다.
      // 실제 아바타 장착용 스프라이트 시트는 itemSpriteUrl에 별도로 보존합니다.
      itemImageUrl: item.iconUrl || item.imageUrl,
      itemSpriteUrl: item.imageUrl,
      itemType: item.type as ItemType,
      itemSlot: item.type === 'avatar' ? item.slot : undefined,
      itemDescription: item.description || '',
      occupiesSlots: item.occupiesSlots,
      // 제작 도구에서 만든 room item이 실제 방 배치에서도 같은 크기/방향 정보를 유지하도록 보존합니다.
      roomSize: item.roomSize,
      spriteConfig: item.spriteConfig,
      directionImages: item.directionImages,
      availableDirections: item.availableDirections,
      defaultDirection: item.defaultDirection,
      footprint: item.footprint,
      // 제작 도구에서 만든 3레이어 머리카락이 보상 선택/수령 후에도 그대로 렌더링되도록 보존합니다.
      hairLayerMode: item.hairLayerMode,
      tintMaskUrl: item.tintMaskUrl,
      shadowImageUrl: item.shadowImageUrl,
      outlineImageUrl: item.outlineImageUrl,
      overlayImageUrl: item.overlayImageUrl,
      eyeShadowImageUrl: item.eyeShadowImageUrl,
      underTintMaskUrl: item.underTintMaskUrl,
      underShadowImageUrl: item.underShadowImageUrl,
      underOutlineImageUrl: item.underOutlineImageUrl,
      upperTintMaskUrl: item.upperTintMaskUrl,
      upperShadowImageUrl: item.upperShadowImageUrl,
      upperOutlineImageUrl: item.upperOutlineImageUrl,
      curriculum: item.curriculum || item.rewardCategory || item.categoryMeta,
      grade: item.grade,
      semester: item.semester,
      subject: item.subject,
      unit: item.unit,
    } as any);
    setShowItemSearch(false);
    setSearchQuery('');
  };

  // 검색 결과 (room item + 기타)
  const getSearchResults = () => {
    const roomItems = searchQuery.trim() ? searchRoomItems(searchQuery) : getAllRoomItems();
    const customItems = searchQuery.trim() ? searchCustomItems(searchQuery) : getCustomItems();
    const byId = new Map<string, any>();
    const folderItems = getRewardFolderItems();
    [...folderItems, ...customItems, ...roomItems].forEach(item => byId.set(item.id, item));
    return Array.from(byId.values()).filter(item => matchesRewardCategoryFilter(item, categoryFilter));
  };

  const subjectOptions = getRewardSubjectsForGrade(categoryFilter.grade);
  const unitOptions = (() => {
    const byId = new Map(getRewardUnits(categoryFilter).map(option => [option.id, option]));
    getRewardFolderItems().forEach(item => {
      if (!item.unit) return;
      if (categoryFilter.grade && item.grade !== categoryFilter.grade) return;
      if (categoryFilter.semester && item.semester !== categoryFilter.semester) return;
      if (categoryFilter.subject && item.subject !== categoryFilter.subject) return;
      if (!byId.has(item.unit)) byId.set(item.unit, { id: item.unit, name: item.unit });
    });
    return Array.from(byId.values());
  })();
  const updateCategoryFilter = (patch: Partial<typeof categoryFilter>) => {
    setCategoryFilter(prev => ({ ...prev, ...patch }));
  };
  const resetCategoryFilter = () => setCategoryFilter({ grade: '', semester: '', subject: '', unit: '' });

  const handleImportRewardItemJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(String(ev.target?.result || ''));
        const item = importCustomItem(json);
        handleSelectExistingItem(item);
      } catch (err) {
        alert('아이템 JSON 불러오기 실패: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Card className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground" 
        onClick={onRemove}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">필요 점수</Label>
            <Input 
              type="number" 
              value={reward.requiredScore} 
              onChange={(e) => update({ requiredScore: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">아이템 이름</Label>
            <Input 
              value={reward.itemName} 
              onChange={(e) => update({ itemName: e.target.value })}
              placeholder="예: 황금 관"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">아이템 유형</Label>
            <Select 
              value={reward.itemType} 
              onValueChange={(val: ItemType) => update({ itemType: val, itemSlot: val === 'avatar' ? 'hat' : undefined })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avatar">아바타 파츠</SelectItem>
                <SelectItem value="badge">뱃지</SelectItem>
                <SelectItem value="room">방 꾸미기</SelectItem>
                <SelectItem value="decoration">장식</SelectItem>
                <SelectItem value="etc">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reward.itemType === 'avatar' && (
            <div className="space-y-1.5">
              <Label className="text-xs">장착 슬롯</Label>
              <Select 
                value={reward.itemSlot} 
                onValueChange={(val: AvatarSlot) => update({ itemSlot: val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cape">망토(Cape)</SelectItem>
                  <SelectItem value="hat">모자(Hat)</SelectItem>
                  <SelectItem value="hair">머리카락(Hair)</SelectItem>
                  <SelectItem value="eyes">눈(Eyes)</SelectItem>
                  <SelectItem value="face">얼굴/표정(Face)</SelectItem>
                  <SelectItem value="top">상의(Top)</SelectItem>
                  <SelectItem value="bottom">하의(Bottom)</SelectItem>
                  <SelectItem value="shoes">신발(Shoes)</SelectItem>
                  <SelectItem value="accessory">액세서리(Acc)</SelectItem>
                  <SelectItem value="pet">펫(Pet)</SelectItem>
                  <SelectItem value="background">배경(BG)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* 기존 아이템 검색 버튼 */}
        <div className="space-y-1.5">
          <Label className="text-xs">기존 아이템 검색</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm"
            onClick={() => setShowItemSearch(!showItemSearch)}
          >
            <Search className="w-4 h-4 mr-2" />
            {showItemSearch ? '검색 닫기' : '아이템 검색'}
          </Button>
        </div>

        {/* 아이템 검색 결과 */}
        {showItemSearch && (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex gap-2">
              <Input
                placeholder="아이템 이름으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
              <label className="relative shrink-0">
                <input type="file" accept=".json,application/json" onChange={handleImportRewardItemJson} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <span>JSON</span>
                </Button>
              </label>
            </div>

            <div className="rounded-md border bg-background/70 p-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">학년/학기/과목/단원 필터</p>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetCategoryFilter}>전체</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={categoryFilter.grade || 'all'} onValueChange={(value) => updateCategoryFilter(value === 'general' ? { grade: 'general', semester: '', subject: '', unit: '' } : { grade: value === 'all' ? '' : value, subject: '', unit: '' })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="학년 전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">학년 전체</SelectItem>
                    <SelectItem value="general">공통</SelectItem>
                    {REWARD_GRADE_OPTIONS.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter.semester || 'all'} onValueChange={(value) => updateCategoryFilter({ semester: value === 'all' ? '' : value, unit: '' })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="학기 전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">학기 전체</SelectItem>
                    {REWARD_SEMESTER_OPTIONS.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter.subject || 'all'} onValueChange={(value) => updateCategoryFilter({ subject: value === 'all' ? '' : value, unit: '' })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="과목 전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">과목 전체</SelectItem>
                    {subjectOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter.unit || 'all'} onValueChange={(value) => updateCategoryFilter({ unit: value === 'all' ? '' : value })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="단원 전체" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">단원 전체</SelectItem>
                    {unitOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">아무 항목도 선택하지 않으면 전체 아이템이 표시됩니다. 하위 항목은 선택하지 않아도 상위 범위 전체가 검색됩니다.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {getSearchResults().map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectExistingItem(item)}
                  className="flex flex-col items-center gap-1 p-2 rounded border hover:bg-primary/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded flex items-center justify-center bg-muted/50 overflow-hidden">
                    {getRoomItemById(item.id) ? (
                      <div style={getRoomItemFrameStyle(item.id, 'front', 36)} />
                    ) : item.iconUrl || item.imageUrl ? (
                      <img src={item.iconUrl || item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-lg">{item.icon}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-center line-clamp-2">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">아이템 이미지/아이콘</Label>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 border rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden relative group">
                {reward.itemType === 'room' && reward.itemId && getRoomItemById(reward.itemId) ? (
                  <div style={getRoomItemFrameStyle(reward.itemId, 'front', 56)} />
                ) : reward.itemImageUrl ? (
                  <img src={reward.itemImageUrl} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-3xl">{reward.itemIcon}</span>
                )}
                <label className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <ImageIcon className="w-5 h-5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
              {reward.itemImageUrl && (
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] mt-1 text-destructive" onClick={() => update({ itemImageUrl: undefined })}>
                  이미지 제거
                </Button>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input 
                placeholder="이모지 입력 (이미지 없을 때 사용)" 
                value={reward.itemIcon} 
                onChange={(e) => update({ itemIcon: e.target.value })}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">이미지를 업로드하면 이모지보다 우선적으로 표시됩니다.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
