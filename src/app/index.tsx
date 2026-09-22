import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

// --- SUPABASE MAGIC NOTEBOOK CONNECTION ---
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// 🛑 PASTE YOUR SECRETS HERE 🛑
const supabaseUrl = 'https://cfoopqwjbwirgfiyyzar.supabase.co';
const supabaseAnonKey = 'sb_publishable_XU3uCOLod3xbhxAtaU-8hQ_-bG4gvCX';
const supabase = createClient(supabaseUrl, supabaseAnonKey);
// ------------------------------------------

const FALLBACK_QUESTIONS = [
  { question: "What is the sum of the roots of x² - 7x + 12 = 0?", options: ["5", "7", "12", "-7"], correctAnswer: 1 },
  { question: "The roots of x² - 5x + k = 0 differ by 1. What is k?", options: ["4", "5", "6", "8"], correctAnswer: 2 },
  { question: "Six friends A to F sit around a circular table. A sits opposite D. B sits next to A. C sits next to D but not next to B. E sits next to B. Who sits opposite F?", options: ["A", "B", "C", "E"], correctAnswer: 2 },
];

const DEFAULT_DOCUMENTS = [
  { id: '1', name: 'Passport_Photo.jpg', size: '15 KB', limit: '20 KB', status: 'Ready', icon: '🖼️', category: 'Identity' },
  { id: '2', name: 'Signature_Scan.jpg', size: '65 KB', limit: '50-90 KB', status: 'Ready', icon: '✍️', category: 'Identity' },
  { id: '3', name: 'Handwritten_Declaration.jpg', size: '82 KB', limit: '50-90 KB', status: 'Ready', icon: '📝', category: 'Identity' },
];

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Local State
  const startLiveQuiz = async () => {
    try {
      console.log("Fetching live questions from the internet...");
      
      const response = await fetch('https://opentdb.com/api.php?amount=10&type=multiple');
      const data = await response.json();
      
      // Helper function to clean HTML entities from text and answers
      const decodeHtml = (html) => {
        return html
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&rsquo;/g, "'")
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"');
      };

      const formattedQuestions = data.results.map((q) => {
        const decodedCorrect = decodeHtml(q.correct_answer);
        const decodedIncorrects = q.incorrect_answers.map(ans => decodeHtml(ans));
        const allOptions = [...decodedIncorrects, decodedCorrect].sort(() => Math.random() - 0.5);

        return {
          question: decodeHtml(q.question),
          options: allOptions,
          correctAnswer: decodedCorrect
        };
      });

      console.log("Internet Quiz Ready with Cleaned Answers:", formattedQuestions);
      setLiveQuestions(formattedQuestions);
      setActiveTab('quiz');
      
    } catch (error) {
      console.error("Failed to fetch internet quiz:", error);
    }
  };
  const [documents, setDocuments] = useState([]);
  const [streak, setStreak] = useState(12);
  const [liveQuestions, setLiveQuestions] = useState(FALLBACK_QUESTIONS);
  const [selectedBrief, setSelectedBrief] = useState<any>(null);
  const [liveBriefs, setLiveBriefs] = useState<any[]>([]);
  // --- LIVE EXAMS (FROM SUPABASE) ---
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
const [isProfileVisible, setProfileVisible] = useState(false);
  // Fetch Live Exams
  useEffect(() => {
    const fetchLiveExams = async () => {
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('*')
          .order('days_left', { ascending: true }); // Puts exams that are soonest at the top!

        if (error) throw error;
        if (data) setUpcomingExams(data);
      } catch (error) {
        console.error("Failed to fetch live exams:", error);
      } finally {
        setIsLoadingExams(false);
      }
    };
    const fetchBriefs = async () => {
  const { data } = await supabase.from('daily_briefs').select('*');
  if (data) setLiveBriefs(data);
};
fetchBriefs();
    fetchLiveExams();
  }, []);
  
  // Quiz State
  const [quizStarted, setQuizStarted] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  // Scratchpad State
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);

  // Calculator State
  const [obtainedMarks, setObtainedMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [calculatedPercentage, setCalculatedPercentage] = useState(null);

  // Dynamic Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Load Saved Documents
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedDocs = await AsyncStorage.getItem('@frmless_vault');
        const savedStreak = await AsyncStorage.getItem('@frmless_streak');
        if (savedDocs !== null) setDocuments(JSON.parse(savedDocs));
        else setDocuments(DEFAULT_DOCUMENTS);
        if (savedStreak !== null) setStreak(parseInt(savedStreak));
      } catch (e) {
        console.error("Failed to load local data", e);
      } finally {
        setIsAppReady(true);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => {
    if (isAppReady) AsyncStorage.setItem('@frmless_vault', JSON.stringify(documents));
  }, [documents, isAppReady]);

  useEffect(() => {
    if (isAppReady) AsyncStorage.setItem('@frmless_streak', streak.toString());
  }, [streak, isAppReady]);

  const changeMonth = (offset) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const daysInMonthCount = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); 
  
  const emptyDays = Array(firstDayOfWeek).fill(null);
  const daysInMonth = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const allDays = [...emptyDays, ...daysInMonth];

  const realToday = new Date();
  const isThisMonth = realToday.getFullYear() === year && realToday.getMonth() === month;
  const todayDateNumber = realToday.getDate();

  const calculatePercentage = () => {
    const obtained = parseFloat(obtainedMarks);
    const total = parseFloat(totalMarks);
    if (!isNaN(obtained) && !isNaN(total) && total > 0) {
      setCalculatedPercentage(((obtained / total) * 100).toFixed(2));
    } else {
      setCalculatedPercentage(null);
    }
  };

  const pickNewDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileSizeKB = (file.size / 1024).toFixed(1);
        const newDoc = {
          id: Date.now().toString(),
          name: file.name,
          size: `${fileSizeKB} KB`,
          limit: 'Unlimited',
          status: 'Ready',
          icon: file.mimeType?.includes('pdf') ? '📑' : '🖼️',
          category: 'Custom Upload'
        };
        setDocuments([newDoc, ...documents]);
      }
    } catch (error) {
      console.log("Error picking document:", error);
    }
  };

  const captureAndResize = async (docType) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      alert("Camera access is required to scan documents!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 1 });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const targetWidth = docType === 'passport' ? 350 : (docType === 'signature' ? 600 : 800);
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth } }],
        { compress: docType === 'passport' ? 0.3 : 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileInfo = await FileSystem.getInfoAsync(manipResult.uri, { size: true });
      const actualSizeKB = (fileInfo.size / 1024).toFixed(1);
      const maxLimit = docType === 'passport' ? 20 : 90;
      const isOverLimit = parseFloat(actualSizeKB) > maxLimit;

      const newDoc = {
        id: Date.now().toString(),
        name: `New_${docType}.jpg`,
        size: `${actualSizeKB} KB`,
        limit: docType === 'passport' ? '20 KB' : '50-90 KB',
        status: isOverLimit ? 'Error' : 'Ready',
        icon: '📸',
        category: 'Scanned Pass'
      };
      
      setDocuments(prev => [newDoc, ...prev]);
    }
  };

  const beginNetworkFetch = () => {
    setQuizStarted(true);
    setIsFetching(true);
    setTimeout(() => {
      setLiveQuestions(FALLBACK_QUESTIONS);
      setIsFetching(false);
    }, 800);
  };

  const handleAnswer = (selectedOption) => {
    const currentQ = liveQuestions[currentQuestion];
    
    const isCorrect = 
      selectedOption === currentQ.correctAnswer || 
      currentQ.options[selectedOption] === currentQ.correctAnswer;

    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestion + 1 < liveQuestions.length) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResult(true);
      setStreak(prev => prev + 1);
    }
  };

  const resetQuiz = () => {
    setQuizStarted(false);
    setIsFetching(false);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
  };

  if (!isAppReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    );
  }

  const renderScreen = () => {
    // HOME TAB
    if (activeTab === 'home') {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollBody, isTablet && styles.tabletCenter]}>
         <ScrollView 
  horizontal 
  showsHorizontalScrollIndicator={false} 
  decelerationRate="fast"
  snapToInterval={(width * 0.85) + 16}
>
  {liveBriefs.map((brief, index) => (
    <TouchableOpacity
      key={index}
      activeOpacity={0.9}
      style={[styles.heroCard, { marginTop: 4, width: width * 0.85, marginRight: 16 }]}
      onPress={() => setSelectedBrief(brief)}
    >
      <View style={styles.heroTopRow}>
        <View style={[styles.badge, { backgroundColor: 'rgba(0, 182, 255, 0.15)' }]}>
          <Text style={[styles.badgeText, { color: '#00B6FF' }]}>LIVE UPDATE</Text>
        </View>
        <Text style={styles.heroTimer}>Swipe for next ➔</Text>
      </View>

      <Text style={styles.heroTitle} numberOfLines={1}>
        {brief.title}
      </Text>
      <Text style={styles.heroSubtitle} numberOfLines={2}>
        {brief.summary}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

          <Text style={styles.sectionTitle}>Exam Schedule</Text>
          
          <View style={styles.calendarCard}>
            <View style={styles.monthHeaderRow}>
              <Text style={styles.monthTitle}>{monthName} {year}</Text>
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton}><Feather name="chevron-left" size={22} color="#111111" /></TouchableOpacity>
                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton}><Feather name="chevron-right" size={22} color="#111111" /></TouchableOpacity>
              </View>
            </View>
            <View style={styles.weekDaysRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (<Text key={i} style={styles.weekDayText}>{day}</Text>))}
            </View>
            <View style={styles.daysGrid}>
              {allDays.map((day, index) => {
          const isToday = isThisMonth && day === todayDateNumber;
          
          // Check if any upcoming exam date matches this calendar square
          const hasExam = day && upcomingExams.some(exam => {
            if (!exam.exam_date) return false;
            const examDayNumber = parseInt(String(exam.exam_date).split('-').pop());
            return examDayNumber === day;
          });

          return (
            <View key={index} style={styles.dayCellWrapper}>
              <View style={[styles.dayCell, isToday ? styles.todayCell : null]}>
                <Text style={[styles.dayText, isToday ? styles.todayText : null]}>{day || ''}</Text>
                {/* Draw a red dot at the bottom of the cell if there is an exam */}
                {hasExam && (
                  <View style={{ width: 4, height: 4, backgroundColor: '#FF3B30', borderRadius: 2, position: 'absolute', bottom: 6 }} />
                )}
              </View>
            </View>
          );
        })}
            </View>
          </View>

          <TouchableOpacity onPress={startLiveQuiz} activeOpacity={0.9} style={[styles.heroCard, { marginTop: 24 }]}>
            <View style={styles.heroTopRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>⚡ {streak}-DAY STREAK</Text></View>
              <Text style={styles.heroTimer}>10 Qs Ready</Text>
            </View>
            <Text style={styles.heroTitle}>Daily Check</Text>
            <Text style={styles.heroSubtitle}>Practice Module Ready</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Upcoming Exams (Live)</Text>

          {isLoadingExams ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#111111" />
              <Text style={{ color: '#8E8E93', marginTop: 12, fontSize: 13, fontWeight: '600' }}>Fetching from portal...</Text>
            </View>
          ) : upcomingExams.length === 0 ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <Text style={{ color: '#8E8E93', fontSize: 14 }}>No upcoming exams found.</Text>
            </View>
          ) : (
            upcomingExams.map((exam) => (
              <View key={exam.id} style={styles.examCard}>
                <View style={styles.examIconBox}>
                  <Text style={styles.examEmoji}>{exam.icon}</Text>
                </View>
                <View style={styles.examInfo}>
                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <Text style={styles.examDate}>{exam.exam_date}</Text>
                </View>
                <View style={styles.countdownBadge}>
                  <Text style={styles.countdownText}>{exam.days_left} Days</Text>
                </View>
              </View>
            ))
          )}
          {/* In-App Reader Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={selectedBrief !== null}
  onRequestClose={() => setSelectedBrief(null)}
>
  <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' }}>
    <View
      style={{
        backgroundColor: '#181818',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
        borderTopWidth: 1,
        borderColor: '#333333',
      }}
    >
      {/* Drag handle pill */}
      <View
        style={{
          width: 40,
          height: 4,
          backgroundColor: '#444444',
          borderRadius: 2,
          alignSelf: 'center',
          marginBottom: 16,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
            Banking & Policy Note
          </Text>
          <Text style={{ color: '#888888', fontSize: 12 }}>
            {selectedBrief?.published_date}
          </Text>
        </View>

        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 14, lineHeight: 26 }}>
          {selectedBrief?.title}
        </Text>

        

        {/* Simple Dismiss Button */}
          <TouchableOpacity 
            onPress={() => setSelectedBrief(null)} 
            style={{ marginTop: 24, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#888888', fontSize: 16, fontWeight: 'bold' }}>
              Close
            </Text>
          </TouchableOpacity>
      </ScrollView>
    </View>
  </View>
</Modal>
        </ScrollView>
      );
    }

    // CALCULATOR TAB
    if (activeTab === 'calc') {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollBody, isTablet && styles.tabletCenter]}>
          <View style={styles.vaultHeaderContainer}>
            <View><Text style={styles.vaultTitle}>Percentage Calculator</Text><Text style={styles.vaultSubtitle}>Quick exam score converter</Text></View>
          </View>
          <View style={styles.calcCard}>
            <Text style={styles.calcLabel}>Marks Obtained</Text>
            <TextInput style={styles.calcInput} placeholder="e.g. 450" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={obtainedMarks} onChangeText={setObtainedMarks} />
            <Text style={styles.calcLabel}>Total Maximum Marks</Text>
            <TextInput style={styles.calcInput} placeholder="e.g. 600" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={totalMarks} onChangeText={setTotalMarks} />
            <TouchableOpacity style={styles.calcButton} onPress={calculatePercentage}><Text style={styles.calcButtonText}>Calculate Percentage</Text></TouchableOpacity>
            {calculatedPercentage !== null && (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Final Percentage</Text>
                <Text style={styles.resultValue}>{calculatedPercentage}%</Text>
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    // VAULT TAB
    if (activeTab === 'vault') {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollBody, isTablet && styles.tabletCenter]}>
          <View style={styles.vaultHeaderContainer}>
            <View><Text style={styles.vaultTitle}>The Vault</Text><Text style={styles.vaultSubtitle}>Secure Document Manager</Text></View>
            <TouchableOpacity onPress={pickNewDocument} style={styles.uploadButton}><Feather name="plus" size={18} color="#FFFFFF" /><Text style={styles.uploadButtonText}>Add</Text></TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Smart Scanners</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCaptureRow}>
            <TouchableOpacity style={styles.captureChip} onPress={() => captureAndResize('passport')}><Text style={styles.captureChipEmoji}>📸</Text><Text style={styles.captureChipText}>Passport</Text></TouchableOpacity>
            <TouchableOpacity style={styles.captureChip} onPress={() => captureAndResize('signature')}><Text style={styles.captureChipEmoji}>✍️</Text><Text style={styles.captureChipText}>Signature</Text></TouchableOpacity>
            <TouchableOpacity style={styles.captureChip} onPress={() => captureAndResize('declaration')}><Text style={styles.captureChipEmoji}>📝</Text><Text style={styles.captureChipText}>Declaration</Text></TouchableOpacity>
          </ScrollView>

          <Text style={styles.sectionTitle}>Vault Stack</Text>
          <View style={styles.walletStackContainer}>
            {documents.map((doc, index) => {
              const isError = doc.status === 'Error';
              const stackOffset = index * 52; 
              return (
                <Pressable key={doc.id} style={({ pressed }) => [styles.walletCard, { top: stackOffset, zIndex: index + 1 }, isError && styles.walletCardError, pressed && { transform: [{ scale: 0.97 }] }]}>
                  <View style={styles.walletTopRow}>
                    <View style={styles.walletHeaderLeft}>
                      <Text style={styles.walletCardCategory}>{doc.category.toUpperCase()}</Text>
                      <Text style={styles.walletCardTitle} numberOfLines={1}>{doc.name}</Text>
                    </View>
                    <Text style={styles.walletCardEmoji}>{doc.icon}</Text>
                  </View>
                  <View style={styles.walletBottomRow}>
                    <View><Text style={styles.walletMetaLabel}>SIZE / LIMIT</Text><Text style={[styles.walletMetaValue, isError && { color: '#FF3B30' }]}>{doc.size} / {doc.limit}</Text></View>
                    {isError ? (
                      <View style={styles.walletFixButton}><Text style={styles.walletFixButtonText}>Fix Size</Text></View>
                    ) : (
                      <View style={styles.walletStatusPill}><View style={styles.walletStatusDot} /><Text style={styles.walletStatusText}>Verified</Text></View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ height: documents.length * 55 + 50 }} />
        </ScrollView>
      );
    } 
    
    // QUIZ TAB
    if (activeTab === 'quiz') {
      if (!quizStarted) {
        return (
          <View style={styles.quizCenterScreen}>
            <Text style={styles.quizStartTitle}>Daily Check</Text>
            <Text style={styles.quizStartSub}>10 Questions • Mixed Syllabus</Text>
            <Text style={styles.quizDifficultyText}>Live Internet Mode</Text>
            <TouchableOpacity onPress={() => setQuizStarted(true)} style={styles.primaryActionButton}>
              <Text style={styles.primaryActionText}>Begin Challenge</Text>
            </TouchableOpacity>
          </View>
        );
      }
      if (isFetching) {
        return (
          <View style={styles.quizCenterScreen}>
            <ActivityIndicator size="large" color="#111111" />
            <Text style={[styles.quizStartTitle, { marginTop: 24, fontSize: 20 }]}>Loading Check...</Text>
          </View>
        );
      }
      if (showResult) {
        return (
          <View style={styles.quizCenterScreen}>
            <Text style={styles.quizStartSub}>CHECK COMPLETE</Text>
            <Text style={styles.scoreText}>{score} / {liveQuestions.length}</Text>
            <Text style={styles.quizStartTitle}>Score</Text>
            <TouchableOpacity onPress={resetQuiz} style={[styles.primaryActionButton, { marginTop: 32 }]}>
              <Text style={styles.primaryActionText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        );
      }

      const question = liveQuestions[currentQuestion];
      return (
        <View style={[styles.quizContainer, isTablet && styles.tabletCenter]}>
          <View style={styles.quizHeader}>
            <View>
              <Text style={styles.questionCounter}>QUESTION {currentQuestion + 1} OF {liveQuestions.length}</Text>
              <Text style={[styles.difficultyIndicator, { color: '#0066FF' }]}>MATH / REASONING / GK / CURRENT AFFAIRS</Text>
            </View>
            <TouchableOpacity onPress={resetQuiz}><Text style={styles.quitText}>Quit</Text></TouchableOpacity>
          </View>
          <Text style={styles.questionText}>{question.question}</Text>
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => (
              <TouchableOpacity key={index} style={styles.optionButton} onPress={() => handleAnswer(index)}>
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={() => setShowScratchpad(true)} style={styles.openScratchpadBtn}>
            <Feather name="edit-3" size={16} color="#FFFFFF" />
            <Text style={styles.openScratchpadText}>Open scratchpad</Text>
          </TouchableOpacity>

          <Modal transparent visible={showScratchpad} animationType="fade">
            <View style={styles.scratchpadModalBg}>
              <SafeAreaView style={{ flex: 1 }}>
                <View 
                  style={styles.drawingArea}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    setCurrentPath([`${locationX},${locationY}`]);
                  }}
                  onResponderMove={(e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    setCurrentPath(prev => [...prev, `${locationX},${locationY}`]);
                  }}
                  onResponderRelease={() => {
                    if (currentPath.length > 0) {
                      setPaths(prev => [...prev, currentPath]);
                      setCurrentPath([]);
                    }
                  }}
                >
                  <View style={styles.scratchpadWatermark}>
                    <Feather name="edit-3" size={80} color="rgba(255,255,255,0.05)" />
                  </View>
                  <Svg style={StyleSheet.absoluteFill}>
                    {paths.map((p, i) => (
                      <Path key={i} d={`M ${p.join(' L ')}`} stroke="#FFD60A" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {currentPath.length > 0 && (
                      <Path d={`M ${currentPath.join(' L ')}`} stroke="#FFD60A" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </Svg>
                </View>
                <View style={styles.scratchpadToolbar}>
                  <TouchableOpacity onPress={() => { setPaths([]); setCurrentPath([]); }} style={styles.scratchpadToolBtn}>
                    <Text style={styles.scratchpadToolText}>Clear</Text>
                  </TouchableOpacity>
                  <Text style={styles.scratchpadTitle}>Scratchpad</Text>
                  <TouchableOpacity onPress={() => setShowScratchpad(false)} style={styles.scratchpadToolBtn}>
                    <Text style={[styles.scratchpadToolText, { fontWeight: '800', color: '#FFD60A' }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          </Modal>

        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, isTablet && styles.tabletCenter, { paddingTop: 50 }]}>
        <TouchableOpacity 
  style={styles.avatarPlaceholder} 
  activeOpacity={0.7}
  onPress={() => setProfileVisible(true)}
>
  <Text style={styles.avatarText}>MG</Text>
</TouchableOpacity>
        <Text style={styles.headerTitle}>FRMless</Text>
      </View>

      {renderScreen()}

      {!showScratchpad && (
        <View style={styles.navDockWrapper}>
          <View style={styles.navDock}>
            <TouchableOpacity onPress={() => { setActiveTab('home'); resetQuiz(); }} style={styles.navItem}><Feather name="home" size={20} color={activeTab === 'home' ? '#FFFFFF' : '#666666'} />{activeTab === 'home' && <View style={styles.activeDot} />}</TouchableOpacity>
            <TouchableOpacity onPress={() => { setActiveTab('vault'); resetQuiz(); }} style={styles.navItem}><Feather name="folder" size={20} color={activeTab === 'vault' ? '#FFFFFF' : '#666666'} />{activeTab === 'vault' && <View style={styles.activeDot} />}</TouchableOpacity>
            <TouchableOpacity onPress={() => { setActiveTab('calc'); resetQuiz(); }} style={styles.navItem}><Feather name="percent" size={20} color={activeTab === 'calc' ? '#FFFFFF' : '#666666'} />{activeTab === 'calc' && <View style={styles.activeDot} />}</TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('quiz')} style={styles.navItem}><Feather name="zap" size={20} color={activeTab === 'quiz' ? '#FFFFFF' : '#666666'} />{activeTab === 'quiz' && <View style={styles.activeDot} />}</TouchableOpacity>
          </View>
        </View>
      )}
      <Modal
        visible={isProfileVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProfileVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.profileSheet}>
  <View style={{ padding: 20 }}>
    <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20 }}>Settings</Text>
    
    {/* Setting Option 1 */}
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <Feather name="user" size={20} color="#FFD52A" />
      <Text style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 15 }}>Edit Profile</Text>
    </TouchableOpacity>

    {/* Setting Option 2 */}
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <Feather name="bell" size={20} color="#FFD52A" />
      <Text style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 15 }}>Notifications</Text>
    </TouchableOpacity>

    {/* Setting Option 3 */}
    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
      <Feather name="moon" size={20} color="#FFD52A" />
      <Text style={{ color: '#FFFFFF', fontSize: 16, marginLeft: 15 }}>Dark Mode</Text>
    </TouchableOpacity>

    {/* Logout Button */}
    <TouchableOpacity 
      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#333' }}
      onPress={() => setProfileVisible(false)}
    >
      <Feather name="log-out" size={20} color="#FF4444" />
      <Text style={{ color: '#FF4444', fontSize: 16, marginLeft: 15 }}>Log Out</Text>
    </TouchableOpacity>
  </View>
</TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  profileSheet: {
    backgroundColor: '#1c1c1e',
    padding: 25,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#444',
    borderRadius: 3,
    marginBottom: 25,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profileTarget: {
    color: '#8e8e93',
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#2c2c2e',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  statValue: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    color: '#a1a1a6',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#3a3a3c',
    paddingVertical: 16,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  tabletCenter: { maxWidth: 600, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111111' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: '#1C1C1E' },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 110, paddingTop: 12 },
  
  heroCard: { backgroundColor: '#111111', borderRadius: 30, padding: 24, marginTop: 8 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: '#222222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#FFD60A', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  heroTimer: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 18 },
  heroSubtitle: { color: '#A1A1A6', fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginTop: 24, marginBottom: 12 },
  examCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  examIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  examEmoji: { fontSize: 22 },
  examInfo: { flex: 1 },
  examTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  examDate: { fontSize: 13, color: '#8E8E93' },
  countdownBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countdownText: { fontSize: 12, fontWeight: '700', color: '#111111' },
  
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: 20 },
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#111111' },
  monthNav: { flexDirection: 'row', gap: 12 },
  navButton: { padding: 4 },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  weekDayText: { fontSize: 12, fontWeight: '700', color: '#8E8E93', width: 32, textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellWrapper: { width: '14.28%', alignItems: 'center', marginBottom: 8, height: 44 },
  dayCell: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  todayCell: { backgroundColor: '#FFD60A' },
  activeDayCell: { backgroundColor: '#111111' },
  dayText: { fontSize: 14, fontWeight: '500', color: '#1C1C1E' },
  todayText: { color: '#111111', fontWeight: '800' },
  activeDayCellText: { color: '#FFFFFF', fontWeight: '800' },
  eventDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#111111', marginTop: 4 },
  
  quizCenterScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  quizStartTitle: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', marginTop: 8 },
  quizStartSub: { fontSize: 14, fontWeight: '700', color: '#8E8E93', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' },
  quizDifficultyText: { fontSize: 14, color: '#8E8E93', marginTop: 8 },
  scoreText: { fontSize: 72, fontWeight: '800', color: '#111111', marginTop: 16 },
  primaryActionButton: { backgroundColor: '#111111', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 32 },
  primaryActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  quizContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  questionCounter: { fontSize: 12, fontWeight: '800', color: '#8E8E93', letterSpacing: 1 },
  difficultyIndicator: { fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  quitText: { fontSize: 14, fontWeight: '700', color: '#FF3B30' },
  questionText: { fontSize: 22, fontWeight: '700', color: '#1C1C1E', lineHeight: 32, marginBottom: 40 },
  optionsContainer: { gap: 16 },
  optionButton: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F2F2F7' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  
  openScratchpadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111111', paddingVertical: 16, borderRadius: 18, marginTop: 32, gap: 8 },
  openScratchpadText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  
  scratchpadModalBg: { flex: 1, backgroundColor: 'rgba(17,17,17,0.96)' },
  drawingArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scratchpadWatermark: { opacity: 0.5 },
  scratchpadToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#333333' },
  scratchpadTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  scratchpadToolBtn: { padding: 12 },
  scratchpadToolText: { color: '#8E8E93', fontSize: 16, fontWeight: '600' },

  vaultHeaderContainer: { marginTop: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vaultTitle: { fontSize: 32, fontWeight: '800', color: '#1C1C1E' },
  vaultSubtitle: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  uploadButton: { flexDirection: 'row', backgroundColor: '#111111', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 6 },
  uploadButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  quickCaptureRow: { gap: 12, marginBottom: 16 },
  captureChip: { backgroundColor: '#111111', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  captureChipEmoji: { fontSize: 16 },
  captureChipText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  walletStackContainer: { position: 'relative', height: 420, marginTop: 4 },
  walletCard: { position: 'absolute', left: 0, right: 0, height: 145, backgroundColor: '#1C1C1E', borderRadius: 24, padding: 22, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  walletCardError: { backgroundColor: '#2A1215', borderColor: 'rgba(255, 59, 48, 0.4)' },
  walletTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  walletHeaderLeft: { flex: 1, paddingRight: 10 },
  walletCardCategory: { fontSize: 11, fontWeight: '800', color: '#8E8E93', letterSpacing: 1.2, marginBottom: 4 },
  walletCardTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  walletCardEmoji: { fontSize: 26 },
  walletBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  walletMetaLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.8, marginBottom: 2 },
  walletMetaValue: { fontSize: 13, fontWeight: '600', color: '#E5E5EA' },
  walletStatusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 125, 50, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
  walletStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CD964' },
  walletStatusText: { fontSize: 12, fontWeight: '700', color: '#4CD964' },
  walletFixButton: { backgroundColor: '#FF3B30', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  walletFixButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  calcCard: { backgroundColor: '#FFFFFF', borderRadius: 26, padding: 24, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  calcLabel: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 },
  calcInput: { backgroundColor: '#F2F2F7', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1C1C1E', marginBottom: 20 },
  calcButton: { backgroundColor: '#111111', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  calcButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  resultBox: { marginTop: 24, padding: 20, backgroundColor: '#F5F5F7', borderRadius: 20, alignItems: 'center' },
  resultLabel: { fontSize: 13, fontWeight: '700', color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1 },
  resultValue: { fontSize: 36, fontWeight: '800', color: '#111111', marginTop: 4 },
  navDockWrapper: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  navDock: { flexDirection: 'row', backgroundColor: '#111111', borderRadius: 36, paddingHorizontal: 24, paddingVertical: 14, gap: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  navItem: { alignItems: 'center', justifyContent: 'center', height: 40, width: 36 },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', position: 'absolute', bottom: -4 },
});