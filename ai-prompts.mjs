function sanitizeChar(c) {
  if (!c || typeof c !== 'object') return {};
  const { image, ...rest } = c; // base64画像はトークン節約のため除外
  return rest;
}

export function buildPrompts(body) {
  if (body.type === 'character') {
    const system = [
      'あなたはオリジナル能力バトル作品のキャラクター設定作成AIです。',
      'ユーザーの要望や既存入力を最大限に尊重し、魅力的で整合性のあるキャラクター設定を日本語で作成してください。',
      '【重要ルール】',
      '・ユーザーが記述した能力の強さ・スケール・コンセプトを勝手に弱体化・改変しないでください。',
      '・出力は必ず純粋なJSONオブジェクトのみとし、Markdownのコードブロック（```json など）や解説文は一切含めないでください。',
      '・JSONのキーは必ず以下の8つすべてを含めてください: "name", "setting", "gender", "speech", "pronoun", "ability", "world", "notes"',
      '・"gender" は必ず「男性」「女性」「その他」「未設定」のいずれかにしてください。',
      '・"ability" には能力名、発動条件、具体的な効果、応用技や制約などを分かりやすく魅力的に記述してください。'
    ].join('\n');

    const prompt = JSON.stringify({
      request: String(body.request || '').slice(0, 4000),
      existing: sanitizeChar(body.existing)
    });
    return { system, prompt, isJson: true };
  }

  if (body.type === 'battle') {
    const isChat = body.style === 'chat';
    const system = [
      'あなたは能力バトル小説の熟練作家兼、論理的な戦闘ジャッジAIです。',
      '2人のオリジナルキャラクターの「能力内容」「制約・弱点」「性格・口調・一人称」「世界設定」を深く読み込み、能力同士の相性・駆け引き・心理戦を臨場感たっぷりの小説形式で描写してください。',
      '【重要ルール】',
      '1. キャラクターの設定・口調・一人称・能力の強さを勝手に改変・弱体化せず、原作設定を忠実に再現すること。',
      '2. 能力の論理的な相互作用（メタ能力、概念干渉、物理法則、発動条件の隙間など）を丁寧に考察し、納得感のある攻防を描くこと。',
      isChat
        ? [
            '3. 【対話型バトル（チャット行動宣言型）モード】',
            '   - プレイヤー（キャラA）の「今回の行動宣言」を受け、その行動がどう作用し、相手（キャラB）がどう反応・反撃するかの『1ターン分の展開』を小説形式で描写してください。',
            '   - まだ決着がつかない場合は物語を途中で止め、末尾に現在の戦況（優劣や状況の変化）と次ターンのヒントを簡潔に添えてください。',
            '   - 決定的な決着がついた場合のみ、末尾に【決着：〇〇の勝利】（または【判定不能】）と明記してください。'
          ].join('\n')
        : [
            '3. 【AI小説型（自動戦闘）モード】',
            '   - 遭遇・能力の探り合いから、中盤の能力のぶつかり合い・奥の手の応酬、そしてクライマックスまでを一編の短編小説として描写してください。',
            '   - 論理的に勝敗が決する場合は末尾に【勝者：キャラクター名】と明記し、勝因を1〜2行で解説してください。',
            '   - 能力の性質上どうしても決着がつかない場合は【判定不能】と明記し、その理由を解説してください。'
          ].join('\n'),
      '4. この裁定は創作上のシミュレーションであり、唯一の絶対的な勝敗ではないことを踏まえ、両キャラの魅力が引き立つ描写を心がけること。'
    ].join('\n');

    const prompt = JSON.stringify({
      mode: isChat ? '対話型バトル（1ターン進行）' : '小説型フルバトル',
      characterA_player: sanitizeChar(body.a),
      characterB_opponent: sanitizeChar(body.b),
      battleHistorySoFar: String(body.history || '').slice(-10000),
      playerActionThisTurn: isChat ? String(body.action || '').slice(0, 2000) : undefined
    });
    return { system, prompt, isJson: false };
  }

  return null;
}

