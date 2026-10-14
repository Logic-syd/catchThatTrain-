# Catch That Train!

[English](#english) · [简体中文](#简体中文)

## English

A mobile-first browser strategy game about catching a high-speed train in China. Play as four different travelers across six stations, dodge obstacles, find your way, manage your energy, and deal with interruptions before boarding closes.

Built with **React, TypeScript, and Vite**. The game supports **Simplified Chinese and English**. Use **中 / EN** in the top-right corner to switch languages; your preference is remembered on this device. Switching during a run preserves the current task and progress.

Interface text, dynamic costs, results, achievements, record dates, shared text, and exported images follow the selected language. Help, ticket, and event dialogs also include a language switch. Shared titles adapt to the recipient’s language; image exports retain the language selected when saving. See the [bilingual display rules and verification](docs/design/中英双语显示规则_V1.md).

**[Play the published build](https://logic-syd.github.io/catchThatTrain-/)** · **[Design documents](docs/design/README.md)**

### How to play

1. **Prepare for the trip.** Decide what to eat, what to carry, and whether to check your ID. Preparation costs time but can change your options later.
2. **Take the metro.** Choose a route and direction, watch the station announcements, and get off at the right stop. Missed stops and wrong directions have real consequences.
3. **Get through the station.** Change lanes to avoid luggage and crowds, sprint in short bursts, read signs, choose queues, and complete physical tasks.
4. **Scan your ID and board.** Reaching the gate is only part of the journey. Finish check-in before it closes, then reach the train before departure.

Each round offers two randomly selected stations. Choose one and play in Normal or Extreme mode. Start with the student; a win unlocks the worker, then the tourist, and finally the parent. Family mode is planned and is not yet playable.

### Four travelers, four kinds of pressure

| Traveler | What makes the journey difficult |
| --- | --- |
| **Backpack Student** | Cats, curious crowds, someone needing help, and tempting milk tea. Happiness and morality are story scores; stopping still costs travel time. |
| **Office Worker** | The company keeps sending messages, changing requirements, and calling. Putting work off can make the next interruption longer. |
| **Exhausted Tourist** | Low energy, fatigue, luggage, and unfamiliar corridors. Ask for directions, find signs, and remember the route through the maze. |
| **Parent Traveling with a Child** | Balance your energy with the child's stamina, patience, toilet needs, and distance from you. Repeated incidents build anger; urgent toilet needs prevent sprinting. |

### Six stations

Station maps and metro routes are gameplay abstractions, not real-world travel directions.

| Station | Main challenge |
| --- | --- |
| **Shanghai Hongqiao** | Long corridors, crowded shortcuts, and pacing your energy for the final stretch. |
| **Beijing South** | Find an open entrance and judge security queues by luggage and processing speed. |
| **Guangzhou South** | Compare a quieter outer bridge with a shorter, crowded route that needs another floor change. |
| **Hangzhou East** | Read departure/arrival signs, then match the A/B concourse to your ticket. |
| **Wuhan** | Recognize B1, 1F, and 2F; choose stairs, escalators, or a lift to reach departures. |
| **Zhengzhou East** | Navigate a symmetrical hall and distinguish similar gate numbers such as 21A and 12A. |

### Student chapter

The student thought there was plenty of time and stayed in bed for another five minutes. Now every stop matters.

- Before leaving, choose whether to buy milk tea, check your ID, and eat breakfast. These choices cost 45, 10, and 25 game seconds respectively; skipping costs no fixed time. Milk tea changes agility and energy capacity but occupies a hand, checking the ID reveals its pocket, and breakfast prevents a later hunger penalty. Energy capacity is capped at 100.
- Metro travel is presented in approximately seven real seconds, while its game-time cost comes from the selected route. Transfers and stop decisions take additional time. Preparing near the doors can avoid a 12-game-second crowd delay when getting off.
- A metro incident is selected in advance for 30% of journeys. Viewing the map or redrawing the interface does not reroll it. Student incidents require an actual response; waiting does not automatically clear the task.
- Start walking, avoid visible obstacles, and sprint in short bursts. Walking restores stamina; holding sprint consumes it. Continuous sprinting builds strain and can force a breathing stop costing 105 game seconds. An exhausted student must recover to 15 stamina before sprinting again.
- Stairs consume up to 22 stamina after the upstairs operation. A direct lift has a fixed 35-game-second wait and allows recovery. Escalators require their own climbing or waiting operation.
- Observe security queues rather than choosing solely by head count. High focus reveals more information. Match station signs to the gate on your ticket.
- Your ID is in one of four backpack pockets. Choose a pocket and hold to search. Incorrect searches cost five game seconds; previously searched pockets are not searched again. Checking your ID before leaving fixes it in the front pocket, and finding it on the metro avoids another station search.
- In the final two game minutes, the student's late boost adds 15% sprint speed and 25% recovery. Finish ID scanning and the final boarding taps to win.

### Student × Hongqiao: the operation prototype

Six decisions now take place in small walkable scenes: the upstairs route, escalator entrance, corridor fork, security queue, concourse direction, and check-in lane. Hold the ground to guide the character or use the arrow keys / WASD. Crowds and railings block movement; a choice is submitted only when the character reaches its entrance.

The four roadside temptations can be passed while moving. Tap a hotspot to stop, then hold to take part or choose to leave. Finishing a task resumes ordinary walking when your walking intent is still active. Pausing, opening the map or ticket, or leaving the page cancels that intent; sprinting needs a fresh input after a task.

Backpack swipes, ID searches, upstairs actions, ID scanning, and boarding remain connected to the journey. All eight check-in lanes lead to the gate on your ticket and retain their individual walking and queue costs. Hongqiao escalator scenes reveal this run's actual congestion before entry; other stations retain their existing reveal behavior.

The prototype currently applies to **the student at Shanghai Hongqiao**. Other chapters retain their existing event interactions. The [Hongqiao operation template](docs/design/大学生虹桥操作模板_V1.md) records the complete flow, timing and resource rules, implementation scope, and requirements for future chapters.

### Controls

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Start walking or rest | Use the forward / rest button | `P` toggles walking |
| Change road lanes | Left/right buttons or a horizontal swipe | `←` / `→` or `A` / `D` |
| Sprint | Hold the sprint button; release to walk | Hold `Space` |
| Navigate a Hongqiao entrance scene | Hold a ground target and drag to guide the character | Arrow keys or `WASD` |
| Complete a hold action | Hold the action button; release to pause | Focus the button and hold `Space` / `Enter` |
| Complete a swipe action | Swipe the object upward | Focus the object and press `Space` / `Enter` |

The on-screen instructions give the required action and progress for each task. Colliding with a road obstacle stops the character; switch to an open lane to continue.

### Time, results, and sharing

- Boarding closes **three game minutes before departure**. After scanning your ID, the countdown switches to departure.
- During ordinary station travel, one real second advances four game seconds. Reading, operations, resting, and being blocked advance at normal speed. Metro travel uses the selected route's game-time cost.
- Fixed task costs and actual input time are accounted for separately. Waiting recovery respects each character's resource limits. The same time and movement rules support budgets, forecasts, and results.
- The student has a 180-game-second environmental loss budget for escalator waits. Voluntary delays, wrong turns, preparation, queues, and incorrect pocket searches are tracked separately.
- Results show a title, tags, key causes, station advice, and an expandable time breakdown. Estimated effects are labeled as estimates; comparison gains are not added to total time a second time.
- Share a result to invite a friend to the same station, or save a result image. The shared link includes the station, title, and result, without uploading your local records or achievements.
- Achievements and the latest 30 records are stored in the current browser and do not sync between devices. Character unlocks, streaks, and hidden achievements use actual completed runs; repeated result processing does not grant duplicate progress.

### Run locally

Requires **Node.js 20+** and npm.

```bash
git clone https://github.com/Logic-syd/catchThatTrain-.git
cd catchThatTrain-
npm ci
npm run dev
```

Vite normally serves the game at **http://localhost:5173/**. Use the address printed in the terminal if that port is occupied.

```bash
npm test          # Run the Vitest suite
npm run build    # Type-check and build into dist/
npm run preview  # Preview the production build locally
```

### Balance and verification

The design targets for a reasonable novice are six-station averages: **student 85–90%, worker 70%, tourist 60%, parent 40%**, with a future family target of 20%. The middle three targets prioritize a ±3 percentage-point range and allow at most ±5. Normal and Extreme are evaluated separately. These are calibration targets under stated input assumptions, not measured human win rates.

The latest documented Hongqiao prototype verification includes **524 passing tests**, a production build, mobile layouts at 320px and 390px, and a complete station journey using real browser inputs. An independent 4,320-game simulation with input model v4 produced student novice averages of **87.6% in Normal** and **87.1% in Extreme**. Browser fixture boundaries, strategy assumptions, per-station results, and limitations are recorded in the [operation template](docs/design/大学生虹桥操作模板_V1.md) and [36-cell results CSV](docs/design/虹桥操作样板验证_V1.csv).

Tests cover preparation benefits, resource caps, waiting settlement, the shared clock, obstacles, sprint state, ID searches, all six chapters, result attribution, and achievement persistence. Historical balance reports retain their original input models and samples. See the [difficulty policy](docs/design/难度区间与首关体验_V3.md) for current targets and budget rules.

### Project structure

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Main interface, journey screens, and event interactions |
| `src/i18n.ts`, `src/locales/` | Language preference, display translation, and English catalogs |
| `src/engine.ts` | Run state, transitions, deadlines, resources, and logs |
| `src/gameClock.ts`, `src/timeModel.ts`, `src/waiting.ts` | Shared clock, travel estimates, and waiting settlement |
| `src/stations.ts`, `src/stationJourney.ts`, `src/StationMaps.tsx` | Station layouts, branches, journeys, and maps |
| `src/Station.tsx`, `src/runner.ts` | Road movement, lane obstacles, and sprint controls |
| `src/SpatialChoice.tsx`, `src/spatialChoice.ts`, `src/hongqiao.ts` | Hongqiao entrance scenes and optional roadside activities |
| `src/studentConfig.ts`, `src/characterTime.ts`, `src/parent.ts` | Character preparation, movement, and resource rules |
| `src/characterChallenges.ts`, `src/touristMaze.ts` | Student temptations, company demands, anger, and maze navigation |
| `src/MetroJourney.tsx`, `src/metroFlow.ts` | Metro travel, stops, transfers, and incidents |
| `src/outcomes.ts`, `src/achievements.ts`, `src/Results.tsx` | Result analysis, unlocks, achievements, and sharing |
| `scripts/` | Balance and success-rate simulations |
| `docs/design/` | Original design drafts, current rules, templates, and validation records |

### Development and deployment

Create a `codex/<feature-name>` branch from `main` and submit a pull request. The [GitHub Actions workflow](.github/workflows/pages.yml) runs tests and builds on pull requests. Updates to `main` also deploy the build to GitHub Pages; the published demo updates after deployment.

For Pages builds, the workflow sets `GITHUB_PAGES_BASE=/catchThatTrain-/`. Local development uses `/`. Release tags such as `v0.1.0-beta.1` identify a fixed revision; the demo follows the deployed `main` build.

Before changing gameplay, read [AGENTS.md](AGENTS.md) and the applicable [design rules](docs/design/README.md). Preserve original design drafts, record actual costs and benefits, and validate affected flows. New input mechanisms need a new simulation model and independent seeds.

Playtest feedback is most useful with the character, station, mode, device/browser, and the interaction that felt confusing or unfair.

---

## 简体中文

### 我一定会赶上这趟车！

React / TypeScript / Vite 的移动端 H5 小游戏。当前开放六座车站＋背包大学生、打工人、疲惫游客和带娃家长，玩法包含三跑道避障、事件操作与车站分支决策；大学生虹桥已接入按住走位进入口的操作样板。底图和地铁线路都是游戏抽象，不是实际车站导航。

右上角 **中 / EN** 支持随时切换语言并记住选择，帮助、车票和事件弹窗内也有切换入口。界面、动态费用、结算、成就、战绩日期和分享文字同步切换；分享称号按接收者语言显示，战绩图片保持点击保存时的语言。切换保留当前任务与操作进度，规则及验证见[中英双语显示规则](docs/design/中英双语显示规则_V1.md)。

原始产品设计稿与人物、车站、事件、结算文档见 [设计文档索引](docs/design/README.md)。设计稿包含尚未上线的规划；试玩规则以当前版本为准。

### 运行

```sh
npm install
npm run dev
npm test
npm run build
```

需要 Node 20+。首次克隆后也可以用 `npm ci` 按锁文件安装依赖。开发地址通常是 http://localhost:5173/；端口被占用时以终端输出为准。`npm run preview` 可在本地预览生产构建。

### 邀请朋友试玩

手机或电脑打开 [试玩链接](https://logic-syd.github.io/catchThatTrain-/)。每轮会随机出现两个车站。新玩家从背包大学生开始，大学生赶上一次后解锁打工人，打工人赶上一次后解锁疲惫游客，游客赶上一次后解锁带娃家长。结算称号下的「分享称号，叫朋友来挑战」会发送可玩的链接；朋友打开后会看到称号，并可从包含同一座车站的两站中选择。手机优先使用系统分享，不支持时复制文字和链接。完成一局后，也可以告诉我人物、车站、手机型号和哪里觉得不好懂，帮助调整难度。

战绩与成就存在各自浏览器的本地存储中，换手机或清除浏览器数据后不会同步。`main` 每次更新会自动运行测试、构建并部署 GitHub Pages；Pull Request 只做测试和构建，不发布试玩版。游戏支持中英双语，点击右上角 **中 / EN** 即可切换，语言选择会保存在本机；切换时保留当前任务与进度。家庭模式尚未开放。

### 分支与版本

`main` 保持可试玩。从 `main` 新建 `codex/功能名` 分支，完成后通过 Pull Request 合并；合并后的构建会更新试玩链接。确认发布内容后在 `main` 的提交上打 `v0.1.0-beta.1` 这类 tag，以后按 `beta.2`、`beta.3` 递增。tag 记录一个固定版本，试玩链接始终指向最新的 `main`。

### 四个人物的时间系统

四个人物共用停止检票倒计时、地铁行程、站内移动与检票截止规则；时间统一按真实游戏秒扣减，站内持续移动按 4 倍流逝，事件选择和操作时自然倒计时。精力、疲劳、负重和专注会改变移动效率，冲刺消耗精力，走路和休息恢复。

- **背包大学生**：一路遇到小猫、围观人群、需要搀扶的老奶奶和不排队的茶颜悦色。停下会增加幸福感或道德、消耗赶车时间；这两项剧情积分不提高赶车属性。准备、证件、体力与冲刺系统继续生效。
- **打工人**：妈妈留饭、塞土特产；出门回复老板能处理原消息，公司在路上仍会追加确认、改表格和打电话。可以说明赶车、立刻做完或暂不回应；未处理消息会让下一次追问更久。
- **疲惫游客**：低精力、高疲劳出发，可以喝咖啡、轻装、设闹钟补觉。陌生车站增加可走回原处的连廊迷宫，需要问路、找路标并记住走过的位置，确认方向后仍须实际走完通道；行李轮子也有修理或硬拖的代价。
- **带娃家长**：管理家长精力、孩子体力／耐心／尿意与牵手距离。鞋带、蹲地上和照顾事件会积累怒气，达到阈值会停步发作；深呼吸或长时间训话分别影响耗时和孩子耐心。尿急禁冲刺、掉队照顾、最后一次牵手同步冲刺和各站专属事件继续生效。

不同人物会影响同一站的实际步行时间、冲刺余量和事件成本。事件所花的秒数会进入剩余时间和结算时间明细；人物选择和事件日志会进入结算归因；打工人忽略工作消息的记录会在结算与对应成就中保留。

### 大学生章节

故事：觉得肯定来得及，于是又躺了五分钟。四个人物的初始时间共用最快地铁路线、本站步行成本和公开的难度余量，在创建本局时确定。合理新手六站平均目标为大学生85%–90%、打工人70%、游客60%、带娃家长40%；中间三档优先±3、最多±5个百分点，后续家庭20%。普通／极限分别验收，当前参数与模拟结果见[难度区间与首关体验 V3](docs/design/难度区间与首关体验_V3.md)。学生首关强调愉悦感，站内实时显示实际避障次数与估算冲刺追回秒数，让操作成果可见。检票截止在发车前3分钟。所有路线时间均为游戏估时，不是实际交通导航；路线判断、冲刺节奏、操作与停留决定实际余量。

1. 出门前依次决定奶茶、身份证检查和早餐。奶茶固定耗时45游戏秒，敏捷最多+5、精力上限最多+10，进站后前180游戏秒恢复+20%；拿在手上会降低双手操作效率，可以喝完丢入垃圾桶。检查证件耗时10游戏秒，专注最多+10，并记住前袋位置。饭团耗时25游戏秒、精力上限最多+15并提供饱腹；上限封顶100，体力只补本次新增容量。不吃会在进入候车大厅时降低精力上限10。
2. 选择地铁路线和方向。地铁行驶合计压缩为约 7 秒，仍按路线计入游戏分钟。到站要自行下车或继续坐，换乘需要连点操作，提前靠门可避免下车挤人群的 12 秒。未选择下车会继续坐。
3. 30% 的旅程出现一次地铁意外，提前确定，不因查看地图或重绘重新抽取。遇事要自己解决，超时不自动放行，也不增加一次性的超时罚款；自然倒计时继续。
4. 站内点「开始前进」后自动向前，三条跑道通过左右按钮、横滑或 A/D 与方向键切换。行李箱和人群提前可见，撞上会真正停步，换到空道才能继续，不额外罚时间。普通前进恢复体力，按住冲刺消耗体力、松手恢复普通速度，点击「歇一下」停止。虹桥的四项路边诱惑可以直接路过，必须处理的任务结束后自动恢复普通步行；手动暂停、查看车票／地图或切出页面后，需要重新开始前进。其他车站仍在每段尽头处理事件。体力耗尽时减速，恢复到 15 才可再冲刺。连续冲刺还会积累可见的冲刺负荷；走路或主动停下可缓解，到顶就会岔气，必须停步调整并花 105 游戏秒。桌面空格冲刺、P 休息。
5. 上楼选择楼梯、三部随机扶梯或直达电梯。楼梯连点上楼消耗 22 体力；电梯等待 35 游戏秒并恢复体力；虹桥先看现场扶梯的畅通、正常、拥堵状态，绕过人群走入入口；其他车站沿用选定后揭示。上楼时分别连点快走或按住等待。
6. 安检队伍每局换位置，短队未必快。按住观察可看出行李和通行速度；专注高的角色会自动看出信息。后面按本站车票找检票口；查看地图时倒计时继续，可以提前记住所在区域。
7. 身份证在四个书包夹层之一。先选夹层再按住翻找；专注影响提示和搜索效率，翻错扣 5 秒，找过的地方不再重复翻。开局检查过的固定在前袋，取出很快。地铁提前找好后，站内不重复查找。
8. 最后两分钟触发「年轻就是能跑」：冲刺速度 +15%、恢复 +25%。选择检票通道后按住刷证、最后连点登车。
9. 结算先显示本局主称号、1–3 个标签和 2–4 个关键原因，再显示本站策略，完整账单可展开。本机保存最近 30 次战绩，支持导出带称号和原因的图片。

### 大学生虹桥操作样板

上楼方式、扶梯、长廊分岔、安检队伍、大厅方向和八条检票通道，改为在局部场景中按住地面引导人物，也支持方向键／WASD。走进入口才会选中；行李、人群和栏杆需要绕开。所有通道都通往车票上的同一检票口，各自保留真实步行与排队费用。

小猫、围观、扶奶奶和奶茶作为路边热点出现，继续前进就能路过；主动点停后按住参与，也能收手继续赶车。幸福感和道德只影响剧情记录，停留时间仍有成本。原有背包滑动、证件查找、上楼、刷证和登车操作继续衔接。

[大学生虹桥操作模板 V1](docs/design/大学生虹桥操作模板_V1.md)记录全流程、已覆盖范围、共用时间／资源规则、验收及后续迁移要求。新操作使用独立的输入模型 v4 复测，不能直接引用此前 v3 的学生成功率。

### 操作方式

| 操作 | 触屏／鼠标 | 键盘 |
| --- | --- | --- |
| 前进或休息 | 点击前进／休息按钮 | `P` 切换前进状态 |
| 跑道换道 | 左右按钮或横向滑动 | `←`／`→` 或 `A`／`D` |
| 冲刺 | 按住冲刺按钮，松手步行 | 按住空格 |
| 虹桥场景走位 | 按住地面目标，拖动引导人物 | 方向键或 `WASD` |
| 按住任务 | 按住动作按钮，松手暂停 | 聚焦按钮后按住空格／回车 |
| 滑动任务 | 向上滑动物件 | 聚焦物件后按空格／回车 |

具体任务会显示所需动作和完成进度。撞上道路障碍会停步，换到空道后才能继续。

### 六个车站的不同解法

每轮从六站中随机抽出两个不同的候选站，由玩家二选一。切换候选站或难度不会重抽；结算后再开一轮会重新抽取。

| 车站 | 独立底图 | 关键选择与操作 |
| --- | --- | --- |
| 上海虹桥 | 横向长走廊、商店分支、宽大厅、远端终点 | 外侧较远但少路障；近路需要连续避让，长距离要分配体力 |
| 北京南 | 南入口、并列安检队、密集人流区 | 先找开放入口；观察行李与安检速度，最后按住放稳托盘 |
| 广州南 | 南北多区、斜向连桥、中区换层、人流大厅 | 外围连桥少障碍且跳过换层；中区路短但拥挤，还要选电梯或楼梯 |
| 杭州东 | 紧凑 Y 形岔路、东西入口、A/B 连廊 | 两次读牌判断，走错到达出口或 A 廊会折返 |
| 武汉 | B1、1F、2F 三层平台，中庭与两种换层通路 | 先认 2F 出发层，再按体力选择楼梯、随机扶梯或电梯；到平台需确认楼层 |
| 郑州东 | 中央大厅、对称两翼、分散编号检票口 | 先选择 16–30 区，再在相似编号中找 21A；选错扣时且必须重新核对 |

地图随分支显示选中路径；赶路背景、配色、标识、路障序列和事件顺序随车站变化。分支能改变接下来的路程、障碍密度或实际跳过事件。`stationPlaystyle` 保留距离、队伍、导航、换层和综合五种类型。

### 结算与成就 V1.1

- 单局一个确定性主称号，按特殊事件、3 / 10 / 30 秒极限结果、人物、场景、路线与操作依次筛选；最多三个短标签、三条关键原因。详细数据与本站策略默认折叠。
- `resultMetrics.ts` 在行为发生时记录 `TimeImpact`，正数是相对于明确基准的收益，负数是实际额外扣时。安检以本局队伍耗时中位数为基准；冲刺、失败剩余时间标为估算；不虚构检查身份证能省 28 秒。
- `gameResult.ts` 统一 margin、位置和戏剧性指数，标出单项足够覆盖差距的原因，或最小项数组合。随机延误明确标为不可控，不生成责怪玩家的建议。时间影响账本和实际游戏总用时分别展示，不重复相加。
- `titles.ts` 配置五人物称号；`achievementConfig.ts` 使用可序列化规则配置通用、五人物、六站与七项隐藏成就。人物专属事件由实际信号触发，缺失信号不推断为完成。大学生先开放，打工人、游客和带娃家长按通关进度依次解锁；妈妈仍会出现在打工人章节的剧情里。
- `achievements.ts` 存档键为 `train-rush:profile:v1`，含总局数、胜场、全局与人物连胜、车站记录、进度、解锁日期和最近 512 个已处理局 ID。失败打断连续胜利，未完成局不计入，重复结算不累计。浏览器禁用存储时保留本次会话内存进度并显示提示。
- 自动迁移旧 `catch-train-achievements-v1`。已获得的旧徽章保留；条件改变的成就使用新 ID，不把旧计数猜成新条件进度。
- 成就册支持分类、进度条、稀有度和解锁日期；隐藏徽章解锁前不显示名字或条件。一次解锁多项只重点展示最稀有一项，其他折叠。结果动效 1.45 秒内完成，支持减少动态效果设置。
- 战绩图片仅含结果、称号、人物 / 车站、时间 / 距离、标签和一句关键原因。挑战链接仅带车站、称号和胜负，不上传本局记录或本机成就。开发环境输出本局匿名调试指标，不发送网络请求。

### 数值与时间口径

- 大学生基础属性：敏捷 80、精力 90、专注 55、负重 15，范围 0–100。打工人为 60 / 60 / 85 / 35；疲惫游客为 55 / 35 / 50 / 30，另有疲劳值 70。介绍页使用紧凑数值标签。
- 虹桥参数：距离 1.20、人流 1.10、安检 1.00、导航 1.05、垂直移动 1.00。站内正常完成参考约 10 游戏分钟，需要继续试玩微调。
- 游戏时间在站内移动时以 4 倍流逝，读题、操作、休息或被障碍拦住时按正常速度流逝；地铁演出单独扣除路线分钟，避免重复计时。路线中的步行也受敏捷、负重影响。
- 不可控额外损失预算为 180 秒，目前用于扶梯环境等待。主动选择冒风险、走错路、开局消费、排队和翻错书包单独记录，不受该预算保护。
- 结算中的「额外用时」只计算明确扣除的时间。结算新增六类时间明细：地铁路程、站内移动、事件处理、其他等待、主动选择、环境等待，内部汇总等于总耗时。

### 结构

- `src/App.tsx`：主界面、旅程页面和事件操作。
- `src/i18n.ts` / `src/locales/`：语言偏好、显示层翻译与英文词典。
- `src/gameClock.ts` / `src/timeModel.ts` / `src/waiting.ts`：统一时钟、路程预测与等待结算。
- `src/SpatialChoice.tsx` / `src/spatialChoice.ts` / `src/hongqiao.ts`：虹桥入口走位与可选路边活动。
- `src/stations.ts` / `src/StationMaps.tsx`：六站配置、路径拓扑、专属选择、独立 SVG 底图与赶路背景。
- `src/outcomes.ts` / `src/achievements.ts` / `src/Results.tsx`：确定性称号、因果归纳、长期成就与结算界面。
- `src/studentConfig.ts`：大学生属性、准备选择、虹桥参数、书包、安检配置和计算函数。
- `src/characterTime.ts`：打工人和游客的时间 / 精力档案、准备选择、行程事件与移动效率。
- `src/characterChallenges.ts` / `src/touristMaze.ts` / `src/CharacterChallengeUI.tsx`：人物诱惑、公司追加任务、游客寻路状态与地图、结算复盘。
- `src/parent.ts`、`src/ParentUI.tsx`：带娃家长与孩子的状态、停步事件、站点选择和操作界面。
- `src/engine.ts`：状态机、时间、体力、准备效果、事件进程与记录。
- `src/stationJourney.ts`：分段路线、上楼分支和各段事件。
- `src/StudentUI.tsx`：开局准备、体力、四夹层书包和结算复盘。
- `src/Station.tsx`：线性站内场景、走路与冲刺输入。
- `src/MetroJourney.tsx` / `src/metroFlow.ts`：地铁停站、提前靠门和意外。
- `src/HoldAction.tsx`：可用触摸、鼠标和键盘的按住操作。
- `src/data.ts` / `src/flow.ts` / `src/stationEncounters.ts`：基础城市、事件和扶梯、老人遭遇。
- `src/Scenes.tsx` / `src/StationEventArt.tsx`：SVG 场景。
- `src/stationFlow.ts` / `src/navigation.ts`：旧版地图的辅助代码，不用于当前站内玩法。

### 验证

`src/student.test.ts` 验证大学生准备成本、体力、疲劳、最后冲刺、地图、安检信息、书包搜索、提前靠门、环境预算和三条路线的完整通关。`src/sprintBalance.test.ts` 对六站多个随机种子验证：一路无脑冲必败，普通走路与分段冲刺仍可通关，岔气停步不会跳过当前路段。其他测试使用明确的旧版 fixtures 保留原引擎回归覆盖。

历史手机浏览器检查覆盖准备、四夹层、持续输入、碰撞停步、换道、休息、楼梯／扶梯、检票、登车与重玩；具体版本与覆盖边界保存在对应设计验证记录中。

`src/runner.test.ts` 覆盖碰撞拦停、换道解锁、冲刺松手恢复普通前进、时钟明细汇总，以及 60 个随机种子和三条路线的普通模式容错：不冲刺、每题阅读 7 秒、较慢安检队和拥堵扶梯仍可赶上。

`src/chapters.test.ts` 覆盖六站拓扑、广州跳过换层、武汉资源选择、郑州错误锁定、六站地铁路线、称号边界、停留与翻包归因、成就去重／连胜／本机存储。

V1.1 专项测试 `src/resultsV11.test.ts` 覆盖文档 A–H、单项 / 组合因果、七项隐藏成就、人物独立进度、去重、旧档迁移、存储异常与事件时记账。人物新机制与历史四人物矩阵见[人物规则 V2](docs/design/人物难点与事件规则_V2.md)，历史学生操作模型与校准记录见[首关体验 V3](docs/design/难度区间与首关体验_V3.md)。

虹桥操作样板最近一次记录包含 **524 项测试通过**、生产构建、320px／390px 手机布局检查和真实浏览器站内流程。独立的 4,320 局输入模型 v4 模拟中，大学生合理新手六站平均成功率为**普通 87.6%、极限 87.1%**。浏览器 fixture、策略假设、各站结果和适用限制见[操作模板](docs/design/大学生虹桥操作模板_V1.md)与[36 格结果 CSV](docs/design/虹桥操作样板验证_V1.csv)。模拟结果不等于真人首玩胜率，历史报告也不替代新操作的验证。

### 参与开发与试玩反馈

修改玩法前阅读 [AGENTS.md](AGENTS.md) 与适用的[设计规则](docs/design/README.md)。保留原始稿件，写清实际成本与收益，并验证受影响流程。新增操作形式需要更新模拟模型并使用独立种子。

[GitHub Actions 工作流](.github/workflows/pages.yml) 使用 Node 20 运行测试和构建；Pages 构建设置 `GITHUB_PAGES_BASE=/catchThatTrain-/`，本地开发使用 `/`。

试玩反馈请附上人物、车站、模式、设备／浏览器，以及哪一步操作觉得难懂或不公平。
