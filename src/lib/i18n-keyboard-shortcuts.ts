import type { Language } from './types'

const zhCN = {
  keyboardShortcuts: '快捷键',
  keyboardShortcutsDescription:
    '自定义主页中的常用操作。方向键、Enter 和 Esc 保持为标准导航键。',
  focusSearchShortcut: '聚焦搜索',
  focusSearchShortcutDescription: '将焦点移到顶部搜索框。',
  openCommandPaletteShortcut: '打开命令面板',
  openCommandPaletteShortcutDescription: '搜索书签并快速执行常用操作。',
  addBookmarkShortcut: '新增书签',
  addBookmarkShortcutDescription: '打开新增书签窗口。',
  recordShortcut: '修改',
  pressShortcut: '按下新快捷键',
  recordingShortcutHint: '按下新快捷键，按 Esc 取消。',
  resetShortcuts: '恢复默认',
  shortcutConflict: '该快捷键已被“{action}”使用。',
  shortcutReserved: '该按键用于浏览器或页面导航，请换一个。',
  shortcutUnsupported: '请按下包含字母、数字或符号的快捷键。',
  browserManagedShortcuts: '浏览器快捷键',
  browserManagedShortcutsDescription:
    '这些按键绑定由浏览器管理。全局命令面板需先启用，快速收藏始终可用。',
  globalCommandPaletteEnabled: '启用全局快捷搜索',
  globalCommandPaletteEnabledDescription:
    '开启后，请在浏览器快捷键设置中分配按键；主页快捷键不受影响。',
  globalCommandPaletteShortcut: '全局命令面板',
  quickSaveCurrentPageShortcut: '快速收藏当前页',
  shortcutLoading: '正在读取…',
  shortcutNotAssigned: '未分配',
  shortcutUnavailable: '无法读取',
  browserShortcutSettingsAddress: '浏览器快捷键设置地址',
  openBrowserShortcutSettings: '去浏览器修改',
  browserShortcutFindExtensionHint: '打开后请在列表中找到“{name}”。',
  openBrowserShortcutSettingsFailed:
    '浏览器阻止了自动打开，请复制地址后手动访问：{url}',
} as const

export type KeyboardShortcutMessageKey = keyof typeof zhCN
type KeyboardShortcutMessages = Record<KeyboardShortcutMessageKey, string>

const zhTW: KeyboardShortcutMessages = {
  keyboardShortcuts: '快速鍵',
  keyboardShortcutsDescription:
    '自訂首頁中的常用操作。方向鍵、Enter 與 Esc 保留為標準導覽鍵。',
  focusSearchShortcut: '聚焦搜尋',
  focusSearchShortcutDescription: '將焦點移至頂部搜尋框。',
  openCommandPaletteShortcut: '開啟命令面板',
  openCommandPaletteShortcutDescription: '搜尋書籤並快速執行常用操作。',
  addBookmarkShortcut: '新增書籤',
  addBookmarkShortcutDescription: '開啟新增書籤視窗。',
  recordShortcut: '修改',
  pressShortcut: '按下新快速鍵',
  recordingShortcutHint: '按下新快速鍵，按 Esc 取消。',
  resetShortcuts: '恢復預設',
  shortcutConflict: '此快速鍵已由「{action}」使用。',
  shortcutReserved: '此按鍵用於瀏覽器或頁面導覽，請改用其他按鍵。',
  shortcutUnsupported: '請按下包含字母、數字或符號的快速鍵。',
  browserManagedShortcuts: '瀏覽器快速鍵',
  browserManagedShortcutsDescription:
    '這些按鍵綁定由瀏覽器管理。全域命令面板需先啟用，快速收藏始終可用。',
  globalCommandPaletteEnabled: '啟用全域快速搜尋',
  globalCommandPaletteEnabledDescription:
    '啟用後，請在瀏覽器快速鍵設定中指派按鍵；首頁快速鍵不受影響。',
  globalCommandPaletteShortcut: '全域命令面板',
  quickSaveCurrentPageShortcut: '快速收藏目前頁面',
  shortcutLoading: '正在讀取…',
  shortcutNotAssigned: '未指派',
  shortcutUnavailable: '無法讀取',
  browserShortcutSettingsAddress: '瀏覽器快速鍵設定網址',
  openBrowserShortcutSettings: '前往瀏覽器修改',
  browserShortcutFindExtensionHint: '開啟後請在清單中找到「{name}」。',
  openBrowserShortcutSettingsFailed:
    '瀏覽器阻止了自動開啟，請複製網址後手動前往：{url}',
}

const en: KeyboardShortcutMessages = {
  keyboardShortcuts: 'Keyboard shortcuts',
  keyboardShortcutsDescription:
    'Customize common home-page actions. Arrow keys, Enter, and Esc remain standard navigation keys.',
  focusSearchShortcut: 'Focus search',
  focusSearchShortcutDescription: 'Move focus to the search field at the top.',
  openCommandPaletteShortcut: 'Open command palette',
  openCommandPaletteShortcutDescription:
    'Search bookmarks and run common actions quickly.',
  addBookmarkShortcut: 'Add bookmark',
  addBookmarkShortcutDescription: 'Open the add-bookmark dialog.',
  recordShortcut: 'Change',
  pressShortcut: 'Press a new shortcut',
  recordingShortcutHint: 'Press a new shortcut, or press Esc to cancel.',
  resetShortcuts: 'Restore defaults',
  shortcutConflict: 'This shortcut is already used by “{action}”.',
  shortcutReserved:
    'This key is reserved for browser or page navigation. Choose another.',
  shortcutUnsupported:
    'Press a shortcut containing a letter, number, or symbol.',
  browserManagedShortcuts: 'Browser shortcuts',
  browserManagedShortcutsDescription:
    'The browser manages these key bindings. Enable the global palette first; Quick Save is always available.',
  globalCommandPaletteEnabled: 'Enable global shortcut search',
  globalCommandPaletteEnabledDescription:
    'After enabling, assign a key in the browser shortcut settings. The home-page shortcut is unaffected.',
  globalCommandPaletteShortcut: 'Global command palette',
  quickSaveCurrentPageShortcut: 'Quick save current page',
  shortcutLoading: 'Loading…',
  shortcutNotAssigned: 'Not assigned',
  shortcutUnavailable: 'Unavailable',
  browserShortcutSettingsAddress: 'Browser shortcut settings address',
  openBrowserShortcutSettings: 'Change in browser',
  browserShortcutFindExtensionHint:
    'After opening the page, find “{name}” in the list.',
  openBrowserShortcutSettingsFailed:
    'The browser blocked automatic opening. Copy and open this address manually: {url}',
}

const ja: KeyboardShortcutMessages = {
  keyboardShortcuts: 'キーボードショートカット',
  keyboardShortcutsDescription:
    'ホーム画面の操作を変更できます。矢印キー、Enter、Esc は標準ナビゲーションとして維持されます。',
  focusSearchShortcut: '検索にフォーカス',
  focusSearchShortcutDescription: '上部の検索欄にフォーカスを移します。',
  openCommandPaletteShortcut: 'コマンドパレットを開く',
  openCommandPaletteShortcutDescription:
    'ブックマークを検索し、よく使う操作をすばやく実行します。',
  addBookmarkShortcut: 'ブックマークを追加',
  addBookmarkShortcutDescription: 'ブックマーク追加画面を開きます。',
  recordShortcut: '変更',
  pressShortcut: '新しいショートカットを入力',
  recordingShortcutHint:
    '新しいショートカットを押します。Esc でキャンセルできます。',
  resetShortcuts: '初期設定に戻す',
  shortcutConflict: 'このショートカットは「{action}」で使用されています。',
  shortcutReserved:
    'ブラウザまたはページ移動用のキーです。別のキーを選んでください。',
  shortcutUnsupported: '文字、数字、記号を含むショートカットを押してください。',
  browserManagedShortcuts: 'ブラウザのショートカット',
  browserManagedShortcutsDescription:
    'キー割り当てはブラウザが管理します。グローバルパレットは先に有効化してください。クイック保存は常に利用できます。',
  globalCommandPaletteEnabled: 'グローバルショートカット検索を有効化',
  globalCommandPaletteEnabledDescription:
    '有効化した後、ブラウザのショートカット設定でキーを割り当ててください。ホーム画面のショートカットには影響しません。',
  globalCommandPaletteShortcut: 'グローバルコマンドパレット',
  quickSaveCurrentPageShortcut: '現在のページをクイック保存',
  shortcutLoading: '読み込み中…',
  shortcutNotAssigned: '未割り当て',
  shortcutUnavailable: '取得できません',
  browserShortcutSettingsAddress: 'ブラウザのショートカット設定アドレス',
  openBrowserShortcutSettings: 'ブラウザで変更',
  browserShortcutFindExtensionHint:
    'ページを開いたら、一覧から「{name}」を探してください。',
  openBrowserShortcutSettingsFailed:
    'ブラウザによって自動表示がブロックされました。次のアドレスをコピーして手動で開いてください：{url}',
}

const ko: KeyboardShortcutMessages = {
  keyboardShortcuts: '키보드 단축키',
  keyboardShortcutsDescription:
    '홈 화면의 주요 동작을 변경합니다. 방향키, Enter, Esc는 표준 탐색 키로 유지됩니다.',
  focusSearchShortcut: '검색창에 포커스',
  focusSearchShortcutDescription: '상단 검색창으로 포커스를 이동합니다.',
  openCommandPaletteShortcut: '명령 팔레트 열기',
  openCommandPaletteShortcutDescription:
    '북마크를 검색하고 자주 쓰는 동작을 빠르게 실행합니다.',
  addBookmarkShortcut: '북마크 추가',
  addBookmarkShortcutDescription: '북마크 추가 창을 엽니다.',
  recordShortcut: '변경',
  pressShortcut: '새 단축키 입력',
  recordingShortcutHint: '새 단축키를 누르세요. Esc를 누르면 취소됩니다.',
  resetShortcuts: '기본값 복원',
  shortcutConflict: '이 단축키는 이미 “{action}”에서 사용 중입니다.',
  shortcutReserved:
    '브라우저 또는 페이지 탐색에 사용되는 키입니다. 다른 키를 선택하세요.',
  shortcutUnsupported: '문자, 숫자 또는 기호가 포함된 단축키를 누르세요.',
  browserManagedShortcuts: '브라우저 단축키',
  browserManagedShortcutsDescription:
    '브라우저가 이 키 바인딩을 관리합니다. 전역 팔레트는 먼저 활성화해야 하며 빠른 저장은 항상 사용할 수 있습니다.',
  globalCommandPaletteEnabled: '전역 단축키 검색 사용',
  globalCommandPaletteEnabledDescription:
    '사용한 후 브라우저 단축키 설정에서 키를 지정하세요. 홈 화면 단축키에는 영향을 주지 않습니다.',
  globalCommandPaletteShortcut: '전역 명령 팔레트',
  quickSaveCurrentPageShortcut: '현재 페이지 빠른 저장',
  shortcutLoading: '불러오는 중…',
  shortcutNotAssigned: '할당되지 않음',
  shortcutUnavailable: '읽을 수 없음',
  browserShortcutSettingsAddress: '브라우저 단축키 설정 주소',
  openBrowserShortcutSettings: '브라우저에서 변경',
  browserShortcutFindExtensionHint:
    '페이지가 열리면 목록에서 “{name}”을 찾으세요.',
  openBrowserShortcutSettingsFailed:
    '브라우저가 자동 열기를 차단했습니다. 다음 주소를 복사해 직접 여세요: {url}',
}

const es: KeyboardShortcutMessages = {
  keyboardShortcuts: 'Atajos de teclado',
  keyboardShortcutsDescription:
    'Personaliza las acciones de la página de inicio. Las flechas, Enter y Esc siguen siendo teclas de navegación.',
  focusSearchShortcut: 'Enfocar la búsqueda',
  focusSearchShortcutDescription:
    'Mueve el foco al campo de búsqueda superior.',
  openCommandPaletteShortcut: 'Abrir la paleta de comandos',
  openCommandPaletteShortcutDescription:
    'Busca marcadores y ejecuta acciones frecuentes rápidamente.',
  addBookmarkShortcut: 'Añadir marcador',
  addBookmarkShortcutDescription: 'Abre el cuadro para añadir un marcador.',
  recordShortcut: 'Cambiar',
  pressShortcut: 'Pulsa un atajo nuevo',
  recordingShortcutHint: 'Pulsa un atajo nuevo o Esc para cancelar.',
  resetShortcuts: 'Restaurar valores',
  shortcutConflict: 'Este atajo ya se usa para «{action}».',
  shortcutReserved:
    'Esta tecla está reservada para el navegador o la navegación. Elige otra.',
  shortcutUnsupported:
    'Pulsa un atajo que incluya una letra, un número o un símbolo.',
  browserManagedShortcuts: 'Atajos del navegador',
  browserManagedShortcutsDescription:
    'El navegador administra estas combinaciones. Activa primero la paleta global; el guardado rápido siempre está disponible.',
  globalCommandPaletteEnabled: 'Activar búsqueda con atajo global',
  globalCommandPaletteEnabledDescription:
    'Después de activarla, asigna una tecla en los ajustes de atajos del navegador. El atajo de inicio no cambia.',
  globalCommandPaletteShortcut: 'Paleta de comandos global',
  quickSaveCurrentPageShortcut: 'Guardar rápidamente la página actual',
  shortcutLoading: 'Cargando…',
  shortcutNotAssigned: 'Sin asignar',
  shortcutUnavailable: 'No disponible',
  browserShortcutSettingsAddress: 'Dirección de ajustes de atajos',
  openBrowserShortcutSettings: 'Cambiar en el navegador',
  browserShortcutFindExtensionHint:
    'Cuando se abra la página, busca «{name}» en la lista.',
  openBrowserShortcutSettingsFailed:
    'El navegador bloqueó la apertura automática. Copia y abre esta dirección manualmente: {url}',
}

const fr: KeyboardShortcutMessages = {
  keyboardShortcuts: 'Raccourcis clavier',
  keyboardShortcutsDescription:
    'Personnalisez les actions de l’accueil. Les flèches, Entrée et Échap restent des touches de navigation.',
  focusSearchShortcut: 'Activer la recherche',
  focusSearchShortcutDescription:
    'Place le focus dans le champ de recherche supérieur.',
  openCommandPaletteShortcut: 'Ouvrir la palette de commandes',
  openCommandPaletteShortcutDescription:
    'Recherchez des favoris et lancez rapidement les actions courantes.',
  addBookmarkShortcut: 'Ajouter un favori',
  addBookmarkShortcutDescription: 'Ouvre la fenêtre d’ajout d’un favori.',
  recordShortcut: 'Modifier',
  pressShortcut: 'Appuyez sur un nouveau raccourci',
  recordingShortcutHint:
    'Appuyez sur un nouveau raccourci ou sur Échap pour annuler.',
  resetShortcuts: 'Rétablir les valeurs',
  shortcutConflict: 'Ce raccourci est déjà utilisé par « {action} ».',
  shortcutReserved:
    'Cette touche est réservée au navigateur ou à la navigation. Choisissez-en une autre.',
  shortcutUnsupported:
    'Utilisez un raccourci contenant une lettre, un chiffre ou un symbole.',
  browserManagedShortcuts: 'Raccourcis du navigateur',
  browserManagedShortcutsDescription:
    'Le navigateur gère ces raccourcis. Activez d’abord la palette globale ; l’enregistrement rapide reste toujours disponible.',
  globalCommandPaletteEnabled: 'Activer la recherche globale par raccourci',
  globalCommandPaletteEnabledDescription:
    'Après activation, attribuez une touche dans les réglages des raccourcis du navigateur. Le raccourci de l’accueil reste inchangé.',
  globalCommandPaletteShortcut: 'Palette de commandes globale',
  quickSaveCurrentPageShortcut: 'Enregistrer rapidement la page actuelle',
  shortcutLoading: 'Chargement…',
  shortcutNotAssigned: 'Non attribué',
  shortcutUnavailable: 'Indisponible',
  browserShortcutSettingsAddress: 'Adresse des réglages de raccourcis',
  openBrowserShortcutSettings: 'Modifier dans le navigateur',
  browserShortcutFindExtensionHint:
    'Une fois la page ouverte, recherchez « {name} » dans la liste.',
  openBrowserShortcutSettingsFailed:
    'Le navigateur a bloqué l’ouverture automatique. Copiez et ouvrez cette adresse manuellement : {url}',
}

export const keyboardShortcutMessages: Record<
  Language,
  KeyboardShortcutMessages
> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
  ko,
  es,
  fr,
}
