# 📚 İngilizce Kelime Öğrenme

İngilizce kelime öğrenmeyi daha etkileşimli ve eğlenceli hale getirmek için geliştirilmiş web tabanlı bir kelime öğrenme uygulamasıdır.

Uygulamada kullanıcılar farklı kategoriler ve seviyeler üzerinden İngilizce kelimeler öğrenebilir, kelimeleri farklı soru tipleriyle tekrar edebilir ve öğrendikleri kelimelerdeki ilerlemelerini takip edebilir.

## ✨ Özellikler

- 📖 A1, A2, B1, B2, C1 ve C2 seviyeleri
- 🎯 Farklı kelime kategorileri
- 🧠 Aşamalı kelime öğrenme sistemi
- 🔤 İngilizce → Türkçe ve Türkçe → İngilizce sorular
- ✍️ Kelime yazma soruları
- 🔊 Dinle ve yaz soru tipi
- 🐢 Yavaş seslendirme seçeneği
- 🐱 Doğru ve yanlış cevaplara görsel tepkiler
- 📊 Öğrenilen kelime sayısını takip etme
- 🔄 Önceki seviyeler için tekrar testleri
- 📚 Kelimeleri tekrar ederek pekiştirme
- 💾 Kullanıcı ilerlemesinin kaydedilmesi
- 📱 Responsive kullanıcı arayüzü

## 🎮 Öğrenme Sistemi

Uygulama kelimeleri tek bir soru tipiyle öğretmek yerine aşamalı bir sistem kullanır.

Bir kelime farklı aşamalardan geçer:

1. **Türkçe → İngilizce seçim**
2. **İngilizce → Türkçe seçim**
3. **Türkçe → İngilizce yazma**
4. **Dinle ve yaz**

Bir kelime tüm aşamaları başarıyla tamamladığında öğrenilmiş olarak işaretlenir.

Kullanıcı bir kelimede art arda hata yaptığında kelime tekrar ilk aşamaya gönderilir.

## 🔄 Seviye Sistemi

Kullanıcının seviyeler arasında ilerlemesi öğrenilen kelime sayısına göre belirlenir.

Bir seviyede yeterli sayıda kelime öğrenildiğinde kullanıcı:

- Bir sonraki seviyeye geçebilir
- Mevcut seviyedeki tüm kelimeleri öğrenmeye devam edebilir

Belirli seviye geçişlerinde önceki seviyelerde öğrenilen kelimeleri kapsayan tekrar testleri uygulanır.

Bu sayede daha önce öğrenilen kelimelerin unutulmasının önüne geçilmesi amaçlanmıştır.

## 🔊 Seslendirme

Uygulamada tarayıcının **Web Speech API / SpeechSynthesis** özelliği kullanılarak İngilizce kelimelerin seslendirilmesi sağlanmaktadır.

Kullanıcı kelimeleri:

- Normal hızda
- Yavaş hızda

dinleyebilir.

## 🛠️ Kullanılan Teknolojiler

- HTML5
- CSS3
- JavaScript
- JSON
- Web Speech API
- Fetch API
- Local Storage

## 📁 Proje Yapısı

```text
ingilizce-kelime-ogrenme/
│
├── index.html
├── script.js
├── words.json
│
├── dogru1.jpg
├── dogru2.jpg
├── dogru3.jpg
├── dogru4.jpg
├── dogru5.jpg
├── dogru6.jpg
├── dogru7.jpg
│
├── yanlis1.jpg
├── yanlis2.jpg
├── yanlis3.jpg
├── yanlis4.jpg
├── yanlis5.jpg
├── yanlis6.jpg
└── yanlis7.jpg
