import type { Language } from './types'

export const aiClassificationPrompts: Record<Language, string> = {
  'zh-CN':
    '你是书签整理助手。根据标题、域名、描述、标签和当前目录，把书签归到最合适的现有目录。优先保持已有合理分类；只有明显更合适时才建议移动；信心不足时保持不变。不要创建、删除或重命名目录。',
  'zh-TW':
    '你是書籤整理助手。根據標題、網域、描述、標籤和目前資料夾，將書籤歸入最適合的現有資料夾。優先保留已有的合理分類；只有明顯更適合時才建議移動；信心不足時保持不變。不要建立、刪除或重新命名資料夾。',
  'en': 'You organize bookmarks. Use each bookmark\'s title, domain, description, tags, and current folder to place it in the most suitable existing folder. Preserve reasonable existing classifications. Suggest a move only when another folder is clearly better, and leave uncertain items unchanged. Do not create, delete, or rename folders.',
  'ja': 'あなたはブックマーク整理アシスタントです。タイトル、ドメイン、説明、タグ、現在のフォルダーを基に、各ブックマークを最適な既存フォルダーに分類してください。既存の妥当な分類を優先し、明らかに適したフォルダーがある場合のみ移動を提案し、確信がない場合は変更しないでください。フォルダーの作成、削除、名称変更はしないでください。',
  'ko': '당신은 북마크 정리 도우미입니다. 제목, 도메인, 설명, 태그, 현재 폴더를 기준으로 각 북마크를 가장 적합한 기존 폴더로 분류하세요. 기존의 합리적인 분류를 우선 유지하고, 다른 폴더가 명백히 더 적합할 때만 이동을 제안하며, 확신할 수 없으면 변경하지 마세요. 폴더를 생성, 삭제 또는 이름 변경하지 마세요.',
  'es': 'Eres un asistente para organizar marcadores. Usa el título, dominio, descripción, etiquetas y carpeta actual de cada marcador para colocarlo en la carpeta existente más adecuada. Conserva las clasificaciones actuales que sean razonables. Sugiere mover un marcador solo si otra carpeta es claramente mejor y no cambies los elementos dudosos. No crees, elimines ni cambies el nombre de las carpetas.',
  'fr': 'Vous êtes un assistant de classement de favoris. Utilisez le titre, le domaine, la description, les étiquettes et le dossier actuel de chaque favori pour le placer dans le dossier existant le plus adapté. Conservez les classements actuels pertinents. Ne suggérez un déplacement que si un autre dossier convient clairement mieux et ne modifiez pas les éléments incertains. Ne créez, ne supprimez et ne renommez aucun dossier.',
}

const zhCN = {
  aiSettings: 'AI',
  aiSettingsDescription: '连接 OpenAI 兼容服务，用 AI 生成书签分类建议。',
  aiProvider: 'OpenAI 兼容配置',
  aiProviderDescription: '配置服务地址、密钥和模型。密钥不会参与同步或备份。',
  aiBaseUrl: 'Base URL',
  aiToken: 'Token',
  aiModel: '模型',
  aiPrompt: '分类提示词',
  aiShowToken: '显示 Token',
  aiHideToken: '隐藏 Token',
  aiFetchModels: '获取模型列表',
  aiFetchingModels: '正在获取',
  aiManualModelHint: '可从列表选择，也可以手动填写模型 ID。',
  aiBatchSize: '每批书签数',
  aiBatchSizeHint: '默认 80。内容特别长时会按字符上限自动拆成更小批次。',
  aiRememberToken: '在此设备上保存 Token',
  aiRememberTokenHint: '关闭时仅保留到当前浏览器会话结束。',
  aiSaveConfiguration: '保存配置',
  aiVerifyConfiguration: '验证连接',
  aiClearToken: '清除 Token',
  aiResetPrompt: '恢复默认提示词',
  aiConfigurationSaved: 'AI 配置已保存',
  aiConnectionVerified: '连接成功，可用模型 {count} 个',
  aiModelsLoaded: '已获取 {count} 个模型',
  aiTokenCleared: 'Token 已清除',
  aiPrivacyNotice: '发送前请确认数据范围',
  aiPrivacyDescription:
    '会发送书签标题、去除查询参数后的网址、描述、标签和目录路径，不发送浏览历史或打开次数。',
  aiClassification: '智能分类',
  aiClassificationDescription:
    'AI 只生成移动建议。你可以逐项检查，确认后才会修改浏览器书签。',
  aiGeneratePreview: '生成分类预览',
  aiGeneratingPreview: '正在分析 {completed}/{total}',
  aiRetryingRequest: '请求暂时失败，正在自动重试 {attempt}/{max}…',
  aiPreviewOnly: '生成预览不会修改任何书签。',
  aiProgressPersists: '关闭设置不会丢失进度和已完成结果。',
  aiPause: '暂停',
  aiPausing: '暂停中',
  aiPaused: '任务已暂停，可稍后继续。',
  aiResume: '继续',
  aiTerminate: '终止',
  aiTerminated: '任务已终止，已完成的结果仍可预览。',
  aiViewPreview: '查看预览',
  aiPreviewTitle: '智能分类预览',
  aiPreviewDescription: '检查每一项移动建议，取消不需要的项目，再确认应用。',
  aiSelectAll: '全选',
  aiSelectNone: '全不选',
  aiSelectedCount: '已选择 {count} 项',
  aiFromFolder: '原目录',
  aiToFolder: '目标目录',
  aiConfidence: '置信度 {count}%',
  aiApplySelected: '确认移动',
  aiApplying: '正在移动',
  aiNoSuggestions: 'AI 没有发现需要调整的书签。',
  aiMoveCompleted: '已移动 {count} 个书签，跳过 {skipped} 个已变化项目。',
  aiUndoAvailable: '最近一次智能分类可在 24 小时内撤销。',
  aiUndo: '撤销智能分类',
  aiUndoCompleted: '已恢复 {count} 个书签，跳过 {skipped} 个项目。',
  aiInvalidBaseUrl: '请输入有效的 HTTP 或 HTTPS 服务地址。',
  aiInsecureEndpoint: '携带 Token 时，HTTP 仅允许 localhost 或回环地址。',
  aiModelRequired: '请填写或选择模型。',
  aiPromptRequired: '请填写分类提示词。',
  aiPermissionDenied: '未获得该服务地址的访问权限。',
  aiInvalidResponse: '模型返回的分类结果格式无效，未修改书签。',
  aiRequestFailed: 'AI 请求失败，请检查地址、Token、模型和服务兼容性。',
  aiApplyFailed: '移动过程中发生错误，已成功移动的项目仍可撤销。',
} as const

export type AiMessageKey = keyof typeof zhCN
type AiMessages = Record<AiMessageKey, string>

const en: AiMessages = {
  aiSettings: 'AI',
  aiSettingsDescription:
    'Connect an OpenAI-compatible service to generate bookmark classification suggestions.',
  aiProvider: 'OpenAI-compatible configuration',
  aiProviderDescription:
    'Configure the endpoint, token, and model. The token is never synced or included in backups.',
  aiBaseUrl: 'Base URL',
  aiToken: 'Token',
  aiModel: 'Model',
  aiPrompt: 'Classification prompt',
  aiShowToken: 'Show token',
  aiHideToken: 'Hide token',
  aiFetchModels: 'Fetch models',
  aiFetchingModels: 'Fetching',
  aiManualModelHint: 'Choose from the list or enter a model ID manually.',
  aiBatchSize: 'Bookmarks per batch',
  aiBatchSizeHint:
    'Defaults to 80. Very long content may be split into smaller batches by the character limit.',
  aiRememberToken: 'Save token on this device',
  aiRememberTokenHint:
    'When off, the token lasts only for this browser session.',
  aiSaveConfiguration: 'Save configuration',
  aiVerifyConfiguration: 'Verify connection',
  aiClearToken: 'Clear token',
  aiResetPrompt: 'Restore default prompt',
  aiConfigurationSaved: 'AI configuration saved',
  aiConnectionVerified: 'Connection verified, {count} models available',
  aiModelsLoaded: 'Loaded {count} models',
  aiTokenCleared: 'Token cleared',
  aiPrivacyNotice: 'Review the data sent to your provider',
  aiPrivacyDescription:
    'Sends titles, URLs without query parameters, descriptions, tags, and folder paths. Browsing history and open counts are excluded.',
  aiClassification: 'Smart classification',
  aiClassificationDescription:
    'AI only creates suggestions. Browser bookmarks change only after you review and confirm them.',
  aiGeneratePreview: 'Generate preview',
  aiGeneratingPreview: 'Analyzing {completed}/{total}',
  aiRetryingRequest:
    'The request temporarily failed. Retrying {attempt}/{max}…',
  aiPreviewOnly: 'Generating a preview does not modify bookmarks.',
  aiProgressPersists:
    'Closing settings keeps the progress and completed results.',
  aiPause: 'Pause',
  aiPausing: 'Pausing',
  aiPaused: 'The task is paused and can be resumed later.',
  aiResume: 'Resume',
  aiTerminate: 'Terminate',
  aiTerminated:
    'The task was terminated. Completed results are still available to preview.',
  aiViewPreview: 'View preview',
  aiPreviewTitle: 'Smart classification preview',
  aiPreviewDescription:
    'Review each move, deselect unwanted items, then confirm the selected changes.',
  aiSelectAll: 'Select all',
  aiSelectNone: 'Select none',
  aiSelectedCount: '{count} selected',
  aiFromFolder: 'From',
  aiToFolder: 'To',
  aiConfidence: '{count}% confidence',
  aiApplySelected: 'Confirm moves',
  aiApplying: 'Moving',
  aiNoSuggestions: 'AI found no bookmarks that need moving.',
  aiMoveCompleted:
    'Moved {count} bookmarks and skipped {skipped} changed items.',
  aiUndoAvailable:
    'The latest smart classification can be undone for 24 hours.',
  aiUndo: 'Undo smart classification',
  aiUndoCompleted: 'Restored {count} bookmarks and skipped {skipped} items.',
  aiInvalidBaseUrl: 'Enter a valid HTTP or HTTPS endpoint.',
  aiInsecureEndpoint:
    'With a token, HTTP is allowed only for localhost or loopback addresses.',
  aiModelRequired: 'Enter or select a model.',
  aiPromptRequired: 'Enter a classification prompt.',
  aiPermissionDenied: 'Access to this service endpoint was not granted.',
  aiInvalidResponse:
    'The model returned an invalid result. No bookmarks were changed.',
  aiRequestFailed:
    'The AI request failed. Check the endpoint, token, model, and provider compatibility.',
  aiApplyFailed: 'A move failed. Successfully moved items can still be undone.',
}

const zhTW: AiMessages = {
  aiSettings: 'AI',
  aiSettingsDescription: '連接 OpenAI 相容服務，使用 AI 產生書籤分類建議。',
  aiProvider: 'OpenAI 相容設定',
  aiProviderDescription:
    '設定服務位址、密鑰和模型。密鑰不會同步或包含在備份中。',
  aiBaseUrl: 'Base URL',
  aiToken: 'Token',
  aiModel: '模型',
  aiPrompt: '分類提示詞',
  aiShowToken: '顯示 Token',
  aiHideToken: '隱藏 Token',
  aiFetchModels: '取得模型清單',
  aiFetchingModels: '正在取得',
  aiManualModelHint: '可從清單選擇，也可手動輸入模型 ID。',
  aiBatchSize: '每批書籤數',
  aiBatchSizeHint: '預設為 80。內容過長時會依字元上限自動分成更小批次。',
  aiRememberToken: '在此裝置上儲存 Token',
  aiRememberTokenHint: '關閉時，Token 只保留到目前瀏覽器工作階段結束。',
  aiSaveConfiguration: '儲存設定',
  aiVerifyConfiguration: '驗證連線',
  aiClearToken: '清除 Token',
  aiResetPrompt: '恢復預設提示詞',
  aiConfigurationSaved: 'AI 設定已儲存',
  aiConnectionVerified: '連線成功，可用模型 {count} 個',
  aiModelsLoaded: '已取得 {count} 個模型',
  aiTokenCleared: 'Token 已清除',
  aiPrivacyNotice: '傳送前請確認資料範圍',
  aiPrivacyDescription:
    '會傳送書籤標題、移除查詢參數後的網址、描述、標籤和資料夾路徑，不會傳送瀏覽記錄或開啟次數。',
  aiClassification: '智慧分類',
  aiClassificationDescription:
    'AI 只會產生移動建議。您可以逐項檢查，確認後才會修改瀏覽器書籤。',
  aiGeneratePreview: '產生分類預覽',
  aiGeneratingPreview: '正在分析 {completed}/{total}',
  aiRetryingRequest: '請求暫時失敗，正在自動重試 {attempt}/{max}…',
  aiPreviewOnly: '產生預覽不會修改任何書籤。',
  aiProgressPersists: '關閉設定不會遺失進度和已完成的結果。',
  aiPause: '暫停',
  aiPausing: '正在暫停',
  aiPaused: '任務已暫停，可稍後繼續。',
  aiResume: '繼續',
  aiTerminate: '終止',
  aiTerminated: '任務已終止，已完成的結果仍可預覽。',
  aiViewPreview: '查看預覽',
  aiPreviewTitle: '智慧分類預覽',
  aiPreviewDescription: '檢查每項移動建議，取消不需要的項目，再確認套用。',
  aiSelectAll: '全選',
  aiSelectNone: '全不選',
  aiSelectedCount: '已選擇 {count} 項',
  aiFromFolder: '原資料夾',
  aiToFolder: '目標資料夾',
  aiConfidence: '信心度 {count}%',
  aiApplySelected: '確認移動',
  aiApplying: '正在移動',
  aiNoSuggestions: 'AI 沒有發現需要調整的書籤。',
  aiMoveCompleted: '已移動 {count} 個書籤，略過 {skipped} 個已變更的項目。',
  aiUndoAvailable: '最近一次智慧分類可在 24 小時內撤銷。',
  aiUndo: '撤銷智慧分類',
  aiUndoCompleted: '已復原 {count} 個書籤，略過 {skipped} 個項目。',
  aiInvalidBaseUrl: '請輸入有效的 HTTP 或 HTTPS 服務位址。',
  aiInsecureEndpoint: '攜帶 Token 時，HTTP 僅允許 localhost 或回環位址。',
  aiModelRequired: '請輸入或選擇模型。',
  aiPromptRequired: '請輸入分類提示詞。',
  aiPermissionDenied: '未獲得此服務位址的存取權限。',
  aiInvalidResponse: '模型回傳的分類結果格式無效，未修改書籤。',
  aiRequestFailed: 'AI 請求失敗，請檢查位址、Token、模型和服務相容性。',
  aiApplyFailed: '移動過程中發生錯誤，已成功移動的項目仍可撤銷。',
}

const ja: AiMessages = {
  aiSettings: 'AI',
  aiSettingsDescription:
    'OpenAI 互換サービスに接続し、AI でブックマークの分類候補を生成します。',
  aiProvider: 'OpenAI 互換設定',
  aiProviderDescription:
    'エンドポイント、トークン、モデルを設定します。トークンは同期やバックアップの対象になりません。',
  aiBaseUrl: 'Base URL',
  aiToken: 'トークン',
  aiModel: 'モデル',
  aiPrompt: '分類プロンプト',
  aiShowToken: 'トークンを表示',
  aiHideToken: 'トークンを非表示',
  aiFetchModels: 'モデル一覧を取得',
  aiFetchingModels: '取得中',
  aiManualModelHint: '一覧から選択するか、モデル ID を直接入力できます。',
  aiBatchSize: '1 バッチあたりのブックマーク数',
  aiBatchSizeHint:
    '既定値は 80 です。内容が非常に長い場合は、文字数の上限に合わせてさらに小さいバッチに分割されます。',
  aiRememberToken: 'このデバイスにトークンを保存',
  aiRememberTokenHint:
    'オフの場合、トークンは現在のブラウザーセッション中のみ保持されます。',
  aiSaveConfiguration: '設定を保存',
  aiVerifyConfiguration: '接続を確認',
  aiClearToken: 'トークンを消去',
  aiResetPrompt: '既定のプロンプトに戻す',
  aiConfigurationSaved: 'AI 設定を保存しました',
  aiConnectionVerified: '接続を確認しました。利用可能なモデルは {count} 個です',
  aiModelsLoaded: '{count} 個のモデルを取得しました',
  aiTokenCleared: 'トークンを消去しました',
  aiPrivacyNotice: '送信されるデータを確認',
  aiPrivacyDescription:
    'タイトル、クエリパラメーターを除いた URL、説明、タグ、フォルダーパスが送信されます。閲覧履歴や開いた回数は送信されません。',
  aiClassification: 'AI スマート分類',
  aiClassificationDescription:
    'AI は移動候補のみを生成します。確認して承認するまで、ブラウザーのブックマークは変更されません。',
  aiGeneratePreview: 'プレビューを生成',
  aiGeneratingPreview: '分析中 {completed}/{total}',
  aiRetryingRequest:
    'リクエストが一時的に失敗しました。自動再試行中 {attempt}/{max}…',
  aiPreviewOnly: 'プレビューの生成でブックマークが変更されることはありません。',
  aiProgressPersists: '設定を閉じても進捗と完了済みの結果は保持されます。',
  aiPause: '一時停止',
  aiPausing: '一時停止中',
  aiPaused: 'タスクは一時停止されました。後で再開できます。',
  aiResume: '再開',
  aiTerminate: '終了',
  aiTerminated:
    'タスクは終了しました。完了済みの結果は引き続きプレビューできます。',
  aiViewPreview: 'プレビューを表示',
  aiPreviewTitle: 'AI スマート分類のプレビュー',
  aiPreviewDescription:
    '各移動候補を確認し、不要な項目の選択を解除してから、選択した変更を適用してください。',
  aiSelectAll: 'すべて選択',
  aiSelectNone: 'すべて解除',
  aiSelectedCount: '{count} 件を選択中',
  aiFromFolder: '移動元',
  aiToFolder: '移動先',
  aiConfidence: '信頼度 {count}%',
  aiApplySelected: '移動を確定',
  aiApplying: '移動中',
  aiNoSuggestions: '分類を変更すべきブックマークは見つかりませんでした。',
  aiMoveCompleted:
    '{count} 個のブックマークを移動し、変更済みの {skipped} 個をスキップしました。',
  aiUndoAvailable: '直近の AI スマート分類は 24 時間以内なら元に戻せます。',
  aiUndo: 'AI スマート分類を元に戻す',
  aiUndoCompleted:
    '{count} 個のブックマークを復元し、{skipped} 個をスキップしました。',
  aiInvalidBaseUrl:
    '有効な HTTP または HTTPS エンドポイントを入力してください。',
  aiInsecureEndpoint:
    'トークンを使用する場合、HTTP は localhost またはループバックアドレスでのみ使用できます。',
  aiModelRequired: 'モデルを入力または選択してください。',
  aiPromptRequired: '分類プロンプトを入力してください。',
  aiPermissionDenied:
    'このサービスエンドポイントへのアクセスが許可されていません。',
  aiInvalidResponse:
    'モデルが無効な形式の分類結果を返しました。ブックマークは変更されていません。',
  aiRequestFailed:
    'AI リクエストに失敗しました。エンドポイント、トークン、モデル、サービスの互換性を確認してください。',
  aiApplyFailed:
    '移動中にエラーが発生しました。移動済みの項目は引き続き元に戻せます。',
}

const ko: AiMessages = {
  aiSettings: 'AI',
  aiSettingsDescription:
    'OpenAI 호환 서비스에 연결하여 AI 북마크 분류 제안을 생성합니다.',
  aiProvider: 'OpenAI 호환 설정',
  aiProviderDescription:
    '엔드포인트, 토큰, 모델을 설정합니다. 토큰은 동기화되거나 백업에 포함되지 않습니다.',
  aiBaseUrl: 'Base URL',
  aiToken: '토큰',
  aiModel: '모델',
  aiPrompt: '분류 프롬프트',
  aiShowToken: '토큰 표시',
  aiHideToken: '토큰 숨기기',
  aiFetchModels: '모델 목록 가져오기',
  aiFetchingModels: '가져오는 중',
  aiManualModelHint: '목록에서 선택하거나 모델 ID를 직접 입력할 수 있습니다.',
  aiBatchSize: '배치당 북마크 수',
  aiBatchSizeHint:
    '기본값은 80입니다. 내용이 매우 길면 문자 수 제한에 맞게 더 작은 배치로 나뉘 수 있습니다.',
  aiRememberToken: '이 기기에 토큰 저장',
  aiRememberTokenHint: '끄면 토큰이 현재 브라우저 세션 동안만 유지됩니다.',
  aiSaveConfiguration: '설정 저장',
  aiVerifyConfiguration: '연결 확인',
  aiClearToken: '토큰 지우기',
  aiResetPrompt: '기본 프롬프트로 복원',
  aiConfigurationSaved: 'AI 설정을 저장했습니다',
  aiConnectionVerified:
    '연결을 확인했습니다. 사용 가능한 모델은 {count}개입니다',
  aiModelsLoaded: '모델 {count}개를 가져왔습니다',
  aiTokenCleared: '토큰을 지웠습니다',
  aiPrivacyNotice: '전송되는 데이터 확인',
  aiPrivacyDescription:
    '제목, 쿼리 매개변수를 제거한 URL, 설명, 태그, 폴더 경로를 전송합니다. 인터넷 사용 기록과 열람 횟수는 전송하지 않습니다.',
  aiClassification: '스마트 분류',
  aiClassificationDescription:
    'AI는 이동 제안만 생성합니다. 검토하고 확인한 후에만 브라우저 북마크가 변경됩니다.',
  aiGeneratePreview: '미리보기 생성',
  aiGeneratingPreview: '분석 중 {completed}/{total}',
  aiRetryingRequest:
    '요청이 일시적으로 실패했습니다. 자동 재시도 중 {attempt}/{max}…',
  aiPreviewOnly: '미리보기를 생성해도 북마크는 변경되지 않습니다.',
  aiProgressPersists: '설정을 닫아도 진행 상황과 완료된 결과가 유지됩니다.',
  aiPause: '일시 중지',
  aiPausing: '일시 중지 중',
  aiPaused: '작업이 일시 중지되었으며 나중에 계속할 수 있습니다.',
  aiResume: '계속',
  aiTerminate: '종료',
  aiTerminated:
    '작업이 종료되었습니다. 완료된 결과는 계속 미리 볼 수 있습니다.',
  aiViewPreview: '미리보기 보기',
  aiPreviewTitle: '스마트 분류 미리보기',
  aiPreviewDescription:
    '각 이동 제안을 검토하고 원하지 않는 항목을 해제한 다음 선택한 변경 사항을 확인하세요.',
  aiSelectAll: '모두 선택',
  aiSelectNone: '모두 해제',
  aiSelectedCount: '{count}개 선택됨',
  aiFromFolder: '원래 폴더',
  aiToFolder: '대상 폴더',
  aiConfidence: '신뢰도 {count}%',
  aiApplySelected: '이동 확인',
  aiApplying: '이동 중',
  aiNoSuggestions: 'AI가 이동할 필요가 있는 북마크를 찾지 못했습니다.',
  aiMoveCompleted:
    '북마크 {count}개를 이동하고 이미 변경된 항목 {skipped}개를 건너뛰었습니다.',
  aiUndoAvailable: '가장 최근 스마트 분류는 24시간 이내에 취소할 수 있습니다.',
  aiUndo: '스마트 분류 취소',
  aiUndoCompleted: '북마크 {count}개를 복원하고 {skipped}개를 건너뛰었습니다.',
  aiInvalidBaseUrl: '유효한 HTTP 또는 HTTPS 엔드포인트를 입력하세요.',
  aiInsecureEndpoint:
    '토큰을 사용할 때 HTTP는 localhost 또는 루프백 주소에서만 허용됩니다.',
  aiModelRequired: '모델을 입력하거나 선택하세요.',
  aiPromptRequired: '분류 프롬프트를 입력하세요.',
  aiPermissionDenied: '이 서비스 엔드포인트에 접근할 권한이 없습니다.',
  aiInvalidResponse:
    '모델이 잘못된 형식의 분류 결과를 반환했습니다. 북마크는 변경되지 않았습니다.',
  aiRequestFailed:
    'AI 요청에 실패했습니다. 엔드포인트, 토큰, 모델, 서비스 호환성을 확인하세요.',
  aiApplyFailed:
    '이동 중 오류가 발생했습니다. 성공적으로 이동된 항목은 계속 취소할 수 있습니다.',
}

const es: AiMessages = {
  aiSettings: 'IA',
  aiSettingsDescription:
    'Conecta un servicio compatible con OpenAI para generar sugerencias de clasificación de marcadores con IA.',
  aiProvider: 'Configuración compatible con OpenAI',
  aiProviderDescription:
    'Configura el punto de conexión, el token y el modelo. El token nunca se sincroniza ni se incluye en las copias de seguridad.',
  aiBaseUrl: 'URL base',
  aiToken: 'Token',
  aiModel: 'Modelo',
  aiPrompt: 'Instrucciones de clasificación',
  aiShowToken: 'Mostrar token',
  aiHideToken: 'Ocultar token',
  aiFetchModels: 'Obtener lista de modelos',
  aiFetchingModels: 'Obteniendo',
  aiManualModelHint:
    'Selecciona un modelo de la lista o introduce su ID manualmente.',
  aiBatchSize: 'Marcadores por lote',
  aiBatchSizeHint:
    'El valor predeterminado es 80. El contenido muy largo puede dividirse en lotes más pequeños según el límite de caracteres.',
  aiRememberToken: 'Guardar el token en este dispositivo',
  aiRememberTokenHint:
    'Si se desactiva, el token solo se conserva durante la sesión actual del navegador.',
  aiSaveConfiguration: 'Guardar configuración',
  aiVerifyConfiguration: 'Verificar conexión',
  aiClearToken: 'Borrar token',
  aiResetPrompt: 'Restaurar instrucciones predeterminadas',
  aiConfigurationSaved: 'Configuración de IA guardada',
  aiConnectionVerified: 'Conexión verificada; hay {count} modelos disponibles',
  aiModelsLoaded: 'Se han obtenido {count} modelos',
  aiTokenCleared: 'Token borrado',
  aiPrivacyNotice: 'Revisa los datos que se enviarán',
  aiPrivacyDescription:
    'Se envían los títulos, las URL sin parámetros de consulta, las descripciones, las etiquetas y las rutas de carpetas. No se envían el historial de navegación ni el número de aperturas.',
  aiClassification: 'Clasificación inteligente',
  aiClassificationDescription:
    'La IA solo genera sugerencias de traslado. Los marcadores del navegador no cambian hasta que los revises y confirmes.',
  aiGeneratePreview: 'Generar vista previa',
  aiGeneratingPreview: 'Analizando {completed}/{total}',
  aiRetryingRequest:
    'La solicitud ha fallado temporalmente. Reintentando automáticamente {attempt}/{max}…',
  aiPreviewOnly: 'Generar una vista previa no modifica ningún marcador.',
  aiProgressPersists:
    'Cerrar la configuración conserva el progreso y los resultados completados.',
  aiPause: 'Pausar',
  aiPausing: 'Pausando',
  aiPaused: 'La tarea está pausada y puede reanudarse más tarde.',
  aiResume: 'Continuar',
  aiTerminate: 'Finalizar',
  aiTerminated:
    'La tarea ha finalizado. Los resultados completados siguen disponibles para su vista previa.',
  aiViewPreview: 'Ver vista previa',
  aiPreviewTitle: 'Vista previa de clasificación inteligente',
  aiPreviewDescription:
    'Revisa cada traslado, desmarca los elementos no deseados y confirma los cambios seleccionados.',
  aiSelectAll: 'Seleccionar todo',
  aiSelectNone: 'Deseleccionar todo',
  aiSelectedCount: '{count} seleccionados',
  aiFromFolder: 'Carpeta de origen',
  aiToFolder: 'Carpeta de destino',
  aiConfidence: '{count}% de confianza',
  aiApplySelected: 'Confirmar traslados',
  aiApplying: 'Trasladando',
  aiNoSuggestions: 'La IA no ha encontrado marcadores que deban trasladarse.',
  aiMoveCompleted:
    'Se han trasladado {count} marcadores y omitido {skipped} elementos modificados.',
  aiUndoAvailable:
    'La clasificación inteligente más reciente se puede deshacer durante 24 horas.',
  aiUndo: 'Deshacer clasificación inteligente',
  aiUndoCompleted:
    'Se han restaurado {count} marcadores y omitido {skipped} elementos.',
  aiInvalidBaseUrl: 'Introduce un punto de conexión HTTP o HTTPS válido.',
  aiInsecureEndpoint:
    'Al usar un token, HTTP solo se permite para localhost o direcciones de bucle invertido.',
  aiModelRequired: 'Introduce o selecciona un modelo.',
  aiPromptRequired: 'Introduce las instrucciones de clasificación.',
  aiPermissionDenied: 'No se ha concedido acceso a este punto de conexión.',
  aiInvalidResponse:
    'El modelo ha devuelto un resultado de clasificación no válido. No se ha modificado ningún marcador.',
  aiRequestFailed:
    'La solicitud de IA ha fallado. Comprueba el punto de conexión, el token, el modelo y la compatibilidad del servicio.',
  aiApplyFailed:
    'Se ha producido un error durante el traslado. Los elementos trasladados correctamente aún se pueden restaurar.',
}

const fr: AiMessages = {
  aiSettings: 'IA',
  aiSettingsDescription:
    'Connectez un service compatible avec OpenAI pour générer des suggestions de classement de favoris avec l\'IA.',
  aiProvider: 'Configuration compatible avec OpenAI',
  aiProviderDescription:
    'Configurez le point de terminaison, le jeton et le modèle. Le jeton n\'est jamais synchronisé ni inclus dans les sauvegardes.',
  aiBaseUrl: 'URL de base',
  aiToken: 'Jeton',
  aiModel: 'Modèle',
  aiPrompt: 'Consigne de classement',
  aiShowToken: 'Afficher le jeton',
  aiHideToken: 'Masquer le jeton',
  aiFetchModels: 'Récupérer la liste des modèles',
  aiFetchingModels: 'Récupération',
  aiManualModelHint:
    'Sélectionnez un modèle dans la liste ou saisissez manuellement son identifiant.',
  aiBatchSize: 'Favoris par lot',
  aiBatchSizeHint:
    'La valeur par défaut est 80. Un contenu très long peut être divisé en lots plus petits selon la limite de caractères.',
  aiRememberToken: 'Enregistrer le jeton sur cet appareil',
  aiRememberTokenHint:
    'Lorsque cette option est désactivée, le jeton est conservé uniquement pendant la session actuelle du navigateur.',
  aiSaveConfiguration: 'Enregistrer la configuration',
  aiVerifyConfiguration: 'Vérifier la connexion',
  aiClearToken: 'Effacer le jeton',
  aiResetPrompt: 'Rétablir la consigne par défaut',
  aiConfigurationSaved: 'Configuration de l\'IA enregistrée',
  aiConnectionVerified: 'Connexion vérifiée, {count} modèles disponibles',
  aiModelsLoaded: '{count} modèles récupérés',
  aiTokenCleared: 'Jeton effacé',
  aiPrivacyNotice: 'Vérifiez les données envoyées',
  aiPrivacyDescription:
    'Les titres, les URL sans paramètres de requête, les descriptions, les étiquettes et les chemins de dossiers sont envoyés. L\'historique de navigation et le nombre d\'ouvertures ne sont pas envoyés.',
  aiClassification: 'Classement intelligent',
  aiClassificationDescription:
    'L\'IA génère uniquement des suggestions de déplacement. Les favoris du navigateur ne changent qu\'après votre vérification et votre confirmation.',
  aiGeneratePreview: 'Générer un aperçu',
  aiGeneratingPreview: 'Analyse {completed}/{total}',
  aiRetryingRequest:
    'La requête a temporairement échoué. Nouvelle tentative automatique {attempt}/{max}…',
  aiPreviewOnly: 'La génération d\'un aperçu ne modifie aucun favori.',
  aiProgressPersists:
    'La fermeture des paramètres conserve la progression et les résultats terminés.',
  aiPause: 'Mettre en pause',
  aiPausing: 'Mise en pause',
  aiPaused: 'La tâche est en pause et peut être reprise ultérieurement.',
  aiResume: 'Continuer',
  aiTerminate: 'Arrêter',
  aiTerminated:
    'La tâche a été arrêtée. Les résultats terminés restent disponibles dans l\'aperçu.',
  aiViewPreview: 'Voir l\'aperçu',
  aiPreviewTitle: 'Aperçu du classement intelligent',
  aiPreviewDescription:
    'Vérifiez chaque déplacement, désélectionnez les éléments indésirables, puis confirmez les modifications sélectionnées.',
  aiSelectAll: 'Tout sélectionner',
  aiSelectNone: 'Tout désélectionner',
  aiSelectedCount: '{count} sélectionnés',
  aiFromFolder: 'Dossier d\'origine',
  aiToFolder: 'Dossier de destination',
  aiConfidence: 'Confiance : {count} %',
  aiApplySelected: 'Confirmer les déplacements',
  aiApplying: 'Déplacement',
  aiNoSuggestions: 'L\'IA n\'a trouvé aucun favori à déplacer.',
  aiMoveCompleted:
    '{count} favoris déplacés et {skipped} éléments modifiés ignorés.',
  aiUndoAvailable:
    'Le dernier classement intelligent peut être annulé pendant 24 heures.',
  aiUndo: 'Annuler le classement intelligent',
  aiUndoCompleted: '{count} favoris restaurés et {skipped} éléments ignorés.',
  aiInvalidBaseUrl: 'Saisissez un point de terminaison HTTP ou HTTPS valide.',
  aiInsecureEndpoint:
    'Avec un jeton, HTTP est autorisé uniquement pour localhost ou les adresses de bouclage.',
  aiModelRequired: 'Saisissez ou sélectionnez un modèle.',
  aiPromptRequired: 'Saisissez une consigne de classement.',
  aiPermissionDenied: 'L\'accès à ce point de terminaison n\'a pas été accordé.',
  aiInvalidResponse:
    'Le modèle a renvoyé un résultat de classement non valide. Aucun favori n\'a été modifié.',
  aiRequestFailed:
    'La requête d\'IA a échoué. Vérifiez le point de terminaison, le jeton, le modèle et la compatibilité du service.',
  aiApplyFailed:
    'Une erreur s\'est produite pendant le déplacement. Les éléments déplacés avec succès peuvent toujours être restaurés.',
}

export const aiMessages: Record<Language, AiMessages> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
  ko,
  es,
  fr,
}
