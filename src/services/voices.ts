// Narrator voices the customer can pick for an animated short (ElevenLabs voice library, multilingual v2 model).
// Curated by hand (Nov 2026): expressive storytellers, each tested with text-to-speech on the Starter plan (library
// voices speak directly by id, no slot in the account). `preview` is ElevenLabs' public
// sample. The first voice of each language is the default.
export interface Voice { id: string; name: string; tagline: string; gender: 'f' | 'm'; preview?: string }

export const VOICES: Record<string, Voice[]> = {
  fr: [
    { id: 'n2pCwUKS6q9Iur03Rten', name: 'Christian', tagline: 'Conteur à suspense, la voix du studio', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/447660a0d48745be9f618782b9398f9b/voices/n2pCwUKS6q9Iur03Rten/5fS0nWB0dDTV9E21JUvf.mp3' },
    { id: 'aQROLel5sQbj1vuIVi6B', name: 'Nicolas', tagline: 'Narrateur posé, très clair', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7593eab373974d1db7d45255c5986d46/voices/aQROLel5sQbj1vuIVi6B/shwzqRrR51OISZWUl7EN.mp3' },
    { id: 't8BrjWUT5Z23DLLBzbuY', name: 'Sarah', tagline: 'Expressive, joue avec le rythme', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/NnZ1eXhNpTYqF1jmlswPUrr9U4v2/voices/t8BrjWUT5Z23DLLBzbuY/Li9DboPs3GZTOiCSBXL4.mp3' },
    { id: 'AfbuxQ9DVtS4azaxN1W7', name: 'Léo', tagline: 'Dynamique et rassurant', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/0c997c49a0d74f83bef0a9d942b92f0f/voices/AfbuxQ9DVtS4azaxN1W7/RdF3GH356ehVu2eylw45.mp3' },
    { id: 'txtf1EDouKke753vN8SL', name: 'Jeanne', tagline: 'Narratrice jeune et calme', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/txtf1EDouKke753vN8SL/KncK9phzELKxzmXlZhBV.mp3' },
    { id: 'a5n9pJUnAhX4fn7lx3uo', name: 'Martin', tagline: 'Grave et chaleureux, un grand-père qui raconte', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/a5n9pJUnAhX4fn7lx3uo/I5TRksrWlXu6l80nTPu2.mp3' },
  ],
  en: [
    { id: 'MFZUKuGQUsGJPQjTS4wC', name: 'Jon', tagline: 'Conteur chaleureux et posé (américain)', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/7bdd69d9e581481a8ea5216493271f81/voices/MFZUKuGQUsGJPQjTS4wC/xEoCh0QqT3VPBukUnnNT.mp3' },
    { id: 'ZF6FPAbjXT4488VcRRnw', name: 'Amelia', tagline: 'Enthousiaste et expressive (britannique)', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/ZF6FPAbjXT4488VcRRnw/PXswrdJcgsGr8VdoVA43.mp3' },
    { id: 'NOpBlnGInO9m6vDvFkFC', name: 'Spuds Oxley', tagline: 'Un grand-père jovial (américain)', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/workspace/64971298bfc24086b69026970a21f1f9/voices/NOpBlnGInO9m6vDvFkFC/M4xySW4rr1SbAKKwMAtI.mp3' },
    { id: 'FVQMzxJGPUBtfz1Azdoy', name: 'Danielle', tagline: 'Narratrice douce et captivante (américaine)', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/FVQMzxJGPUBtfz1Azdoy/gKVnL9faq7ZIq960uZMm.mp3' },
    { id: 'G17SuINrv2H9FC6nvetn', name: 'Christopher', tagline: 'Doux et rassurant (britannique)', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/G17SuINrv2H9FC6nvetn/ofEmJDtVvrmeL3OEs0ig.mp3' },
  ],
  es: [
    { id: 'l1zE9xgNpUTaQCZzpNJa', name: 'Alberto', tagline: 'Narrateur sérieux et proche (argentin)', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/custom/voices/l1zE9xgNpUTaQCZzpNJa/sF0SJSVjERJtMSqfZLPN.mp3' },
    { id: 'Nh2zY9kknu6z4pZy6FhD', name: 'David', tagline: 'Assuré et équilibré (Espagne)', gender: 'm', preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/8RYUsFHsalUXjwVG0LjhNwH1j022/voices/Nh2zY9kknu6z4pZy6FhD/5VD3I67SoLbajJEbw7rH.mp3' },
    { id: 'qBvury71WUJfVeT1STkG', name: 'Samanta', tagline: 'Chaleureuse et expressive (argentine)', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/riNONac0xwYaTxYZybexOztwW113/voices/qBvury71WUJfVeT1STkG/NfVGRfea4ZRHQ0QoFz25.mp3' },
    { id: '2rigMbVWLdqtBSCahJFX', name: 'Tatiana', tagline: 'Sage et tranquille (argentine)', gender: 'f', preview: 'https://storage.googleapis.com/eleven-public-prod/database/user/8RYUsFHsalUXjwVG0LjhNwH1j022/voices/2rigMbVWLdqtBSCahJFX/fZWd6mLqzMJWcNXOh3ea.mp3' },
  ],
};

export const voicesFor = (lang: string): Voice[] => VOICES[lang]?.length ? VOICES[lang]! : VOICES.fr!;
