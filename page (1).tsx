'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Zap, 
  Palette, 
  Home,
  Sparkles,
  ArrowRight,
  Shield
} from 'lucide-react';

/**
 * 쌤퀘스트 랜딩 페이지
 * 개인정보 없이 클래스코드로 시작하는 학급 게임화 플랫폼
 */
export default function HomePage() {
  const features = [
    {
      icon: BookOpen,
      title: '퀴즈 만들기',
      description: '객관식, 단답형, 장문형 문제를 쉽게 만들고 보상을 설정하세요',
    },
    {
      icon: Zap,
      title: '함께 풀기',
      description: '모든 학생이 같은 속도로 문제를 풀고 실시간으로 정답을 확인하세요',
    },
    {
      icon: Sparkles,
      title: '보상 아이템',
      description: '퀴즈를 풀고 얻은 아이템으로 아바타와 방을 꾸미세요',
    },
    {
      icon: Palette,
      title: '아바타 꾸미기',
      description: '피부색, 옷, 머리 등을 자유롭게 선택하여 나만의 캐릭터를 만드세요',
    },
    {
      icon: Home,
      title: '방 꾸미기',
      description: '가구와 장식품으로 나만의 공간을 만들고 아이소메트릭 뷰에서 즐기세요',
    },
    {
      icon: Shield,
      title: '개인정보 보호',
      description: '이름, 이메일, 전화번호 없이 클래스코드와 출석번호만으로 시작하세요',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50">
      {/* 헤더 네비게이션 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="h-10 w-auto object-contain" />
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:block">
              쌤퀘스트
            </div>
          </div>
          <p className="text-sm text-muted-foreground hidden md:block">
            클래스코드로 시작하는 학급 게임화 플랫폼
          </p>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center mb-8">
            <img src="/assets/logo.png" alt="쌤퀘스트 로고" className="w-full max-w-[400px] h-auto drop-shadow-xl" />
          </div>
          
          <h1 className="sr-only">
            쌤퀘스트
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-4 text-pretty">
            클래스코드로 시작하는 학급 퀴즈·보상·아바타 꾸미기 플랫폼
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full w-fit mx-auto">
            <Shield className="w-4 h-4" />
            <span>회원가입 없이 시작 · 개인정보 수집 안 함</span>
          </div>
        </div>

        {/* CTA 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl mx-auto mb-16">
          <Link href="/teacher" className="flex-1">
            <Button
              size="lg"
              className="w-full h-auto py-6 flex flex-col items-center gap-3 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <GraduationCap className="w-6 h-6" />
              <span>교사 시작하기</span>
              <span className="text-xs font-normal opacity-90">클래스 만들고 퀴즈 출제</span>
            </Button>
          </Link>
          
          <Link href="/student" className="flex-1">
            <Button
              size="lg"
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center gap-3 text-lg font-semibold border-2 hover:bg-purple-50"
            >
              <Users className="w-6 h-6" />
              <span>학생 입장하기</span>
              <span className="text-xs font-normal opacity-90">클래스코드 + 출석번호</span>
            </Button>
          </Link>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="bg-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              주요 기능
            </h2>
            <p className="text-lg text-muted-foreground">
              교사와 학생이 함께 즐기는 학급 게임화의 모든 것
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow border-0 bg-gradient-to-br from-blue-50 to-purple-50">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* 사용 흐름 섹션 */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              이렇게 시작하세요
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* 교사용 흐름 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  👨‍🏫
                </div>
                <h3 className="text-2xl font-bold">교사</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { num: 1, text: '클래스 만들기 - 학생 수 입력' },
                  { num: 2, text: '클래스코드 학생에게 공유' },
                  { num: 3, text: '퀴즈와 보상 아이템 만들기' },
                  { num: 4, text: '함께 풀기로 실시간 진행' },
                  { num: 5, text: '학생 현황 및 채점 확인' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {item.num}
                    </div>
                    <p className="text-foreground pt-1">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 학생용 흐름 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  👨‍🎓
                </div>
                <h3 className="text-2xl font-bold">학생</h3>
              </div>
              
              <div className="space-y-4">
                {[
                  { num: 1, text: '클래스코드 + 출석번호 입력' },
                  { num: 2, text: '퀴즈 풀기 또는 함께 풀기 참여' },
                  { num: 3, text: '정답 맞추고 보상 아이템 획득' },
                  { num: 4, text: '아바타와 방 꾸미기' },
                  { num: 5, text: '친구들과 비교하며 즐기기' },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">
                      {item.num}
                    </div>
                    <p className="text-foreground pt-1">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 특징 강조 섹션 */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-8">
            개인정보 수집 없는 안전한 플랫폼
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="text-4xl mb-3">🔐</div>
              <h3 className="text-xl font-bold mb-2">개인정보 보호</h3>
              <p className="opacity-90">이름, 이메일, 전화번호를 수집하지 않습니다</p>
            </div>
            <div>
              <div className="text-4xl mb-3">📱</div>
              <h3 className="text-xl font-bold mb-2">간단한 입장</h3>
              <p className="opacity-90">클래스코드와 출석번호만으로 시작합니다</p>
            </div>
            <div>
              <div className="text-4xl mb-3">🚀</div>
              <h3 className="text-xl font-bold mb-2">빠른 시작</h3>
              <p className="opacity-90">회원가입 없이 즉시 사용할 수 있습니다</p>
            </div>
          </div>

          <Link href="/teacher">
            <Button
              size="lg"
              variant="secondary"
              className="gap-2"
            >
              지금 시작하기
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="text-xl font-bold text-white mb-2">쌤퀘스트</div>
              <p className="text-sm">클래스코드로 시작하는 학급 게임화 플랫폼</p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">빠른 링크</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/teacher" className="hover:text-white transition">교사 시작</Link></li>
                <li><Link href="/student" className="hover:text-white transition">학생 입장</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3">정보</h4>
              <ul className="space-y-2 text-sm">
                <li><span>개인정보 없음</span></li>
                <li><span>프로토타입 버전</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 pt-8 text-center text-sm">
            <p>&copy; 2024 쌤퀘스트. 모든 권리 보유.</p>
            <p className="mt-2 text-xs opacity-75">현재는 localStorage 기반 프로토타입입니다. 실제 운영을 위해서는 서버 DB 연결이 필요합니다.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
