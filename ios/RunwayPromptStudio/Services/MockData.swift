import Foundation

enum MockData {
    static let sampleURL = "https://detail.1688.com/offer/853045769107.html"

    static func product(sourceUrl: String = sampleURL) -> ProductInfo {
        ProductInfo(
            id: UUID().uuidString,
            sourceUrl: sourceUrl,
            normalizedUrl: "https://detail.1688.com/offer/853045769107.html",
            platform: "1688",
            platformProductId: "853045769107",
            title: "跨境批发拼接地毯免胶粘贴地垫全铺地毯整铺方块毯办公室满铺地垫",
            price: "¥1.85-7.50",
            minOrderQuantity: "按规格起批",
            shopName: "义乌市熙然装饰材料有限公司",
            companyName: "义乌市熙然装饰材料有限公司",
            locationText: "浙江 金华",
            categoryText: "家居软装 / 地毯地垫",
            coverImageUrl: "https://images.unsplash.com/photo-1600166898405-da9535204843?auto=format&fit=crop&w=1200&q=85",
            imageUrls: [
                "https://images.unsplash.com/photo-1600166898405-da9535204843?auto=format&fit=crop&w=1200&q=85",
                "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=85",
                "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85"
            ],
            tags: ["批发", "跨境", "地毯", "地垫", "拼接", "免胶", "办公室", "满铺"],
            productFacts: [
                ProductFact(name: "类型", value: "拼接地毯 / 方块地垫"),
                ProductFact(name: "图案", value: "黑白棋盘格"),
                ProductFact(name: "使用方式", value: "免胶粘贴，拼接铺设"),
                ProductFact(name: "适用场景", value: "办公室、租房、卧室、直播间、软装改造"),
                ProductFact(name: "视觉特点", value: "强对比图案，空间改造感明显"),
                ProductFact(name: "表面感受", value: "柔软、亲肤、具有织物纹理"),
                ProductFact(name: "采购特点", value: "低单价，适合批量采购和跨境销售")
            ],
            sellingPoints: [
                "低成本快速改变空间氛围",
                "黑白棋盘格自带视觉记忆点",
                "免胶拼接，适合租房改造",
                "可按面积自由组合",
                "适合拍摄前后对比短视频",
                "单价低，具备批发优势"
            ],
            procurementInsights: [
                "适合软装卖家、跨境家居卖家、办公室装修采购和内容电商选品。",
                "价格区间低，适合以低成本空间改造为核心卖点。",
                "黑白棋盘格具有较强视觉传播力，适合短视频前后对比。",
                "采购方可能关心厚度、防滑、耐脏、拼接稳定性和实际铺设效果。",
                "用于 C 端广告时，应弱化批发属性，强化生活方式和空间氛围。"
            ],
            reviewInsights: [
                "当前页面未提供可直接读取的评论数据，以下洞察基于商品标题、图片、价格、店铺、参数与公开详情信息生成。"
            ],
            reviews: [],
            rawDetailText: "拼接地毯、免胶地垫、办公室满铺、黑白棋盘格、跨境批发。",
            extractionStatus: ExtractionStatus(
                source: "mock_fallback",
                canReadPublicPage: false,
                hasLoginOrCaptchaBlock: false,
                commentsAvailable: false,
                usedMockData: true,
                mockReason: "未能从 1688 页面提取足够商品字段",
                extractedFields: [],
                missingFields: ["title", "price", "images", "shopName", "productFacts", "reviews"],
                message: "当前页面未能读取到足够的真实商品信息，已展示 Mock 演示数据。"
            ),
            extractedAt: Date()
        )
    }

    static func analysis(product: ProductInfo) -> (ProductDiagnosis, [CreativeDirection]) {
        let diagnosis = ProductDiagnosis(
            coreJudgement: "这个商品不应该只被表达为“低价地垫”，而应该被包装成“低成本改造空间氛围的视觉道具”。",
            viralPotentialScore: 4,
            mainOpportunities: ["黑白棋盘格图案天然具有高识别度", "铺设前后对比非常适合短视频表达", "低客单价降低尝试门槛", "免胶拼接适合租房、办公室和临时场景"],
            mainWeaknesses: ["批发页表达偏参数化，缺少生活方式包装", "商品质感需要通过近景镜头证明", "用户可能担心防滑、厚度、耐脏和边缘翘起"],
            visualFocus: ["图案记忆点", "铺设前后对比", "边缘厚度", "脚踩触感", "空间氛围变化"],
            contentHooks: ["一个普通房间，铺上地垫后像换了一个空间", "几十元软装，让出租屋有杂志感", "办公室地面改造前后对比"],
            suitablePlatforms: ["小红书", "抖音", "视频号", "电商详情页"]
        )
        return (diagnosis, directions())
    }

    static func category(product: ProductInfo) -> CategoryAnalysis {
        CategoryAnalysis(
            primaryCategory: "家居软装",
            secondaryCategory: "地毯地垫",
            productType: "拼接地毯 / 方块地垫",
            isFashionProduct: false,
            consumerScenario: "租房、卧室、办公室、直播间等低成本空间改造场景",
            b2bProcurementScenario: "跨境家居卖家、软装渠道、电商内容选品和办公室装修采购",
            visualKeywords: ["黑白棋盘格", "拼接铺设", "空间前后对比", "柔软织物纹理"],
            materialKeywords: ["织物纹理", "地垫边缘", "拼接结构"],
            riskNotes: product.extractionStatus.usedMockData ? ["当前为 Mock 演示数据，不能表述为真实页面证明。"] : ["评论数据未读取。"]
        )
    }

    static func directions() -> [CreativeDirection] {
        [
            CreativeDirection(id: UUID().uuidString, name: "方向 A：实用转化型", targetAudience: "批发采购方、电商卖家、办公室或家庭场景采购者", coreScene: "快速铺设、免胶拼接、按面积自由组合", visualSuggestion: "俯拍完整铺设过程，搭配局部厚度和边缘近景", videoHook: "3 秒铺出一块完整地面，空间立刻变整洁", imageOptimizationSuggestion: "主图加入铺设前后对比和局部纹理放大", suitablePlatform: "电商详情页 / 视频号"),
            CreativeDirection(id: UUID().uuidString, name: "方向 B：生活方式型", targetAudience: "租房青年、小户型家庭、软装爱好者", coreScene: "用低成本地垫改变房间氛围", visualSuggestion: "阳光、奶油色家具、黑白棋盘格、柔软触感", videoHook: "一个普通房间，铺上地垫后突然变得像杂志里的家", imageOptimizationSuggestion: "增加客厅/卧室生活方式图，弱化批发参数感", suitablePlatform: "小红书 / 抖音"),
            CreativeDirection(id: UUID().uuidString, name: "方向 C：强反差传播型", targetAudience: "短视频内容创作者、视觉冲击型广告投放", coreScene: "杂乱地面到高记忆点空间的瞬间切换", visualSuggestion: "前半段普通地面，后半段棋盘格满铺并加入温馨小动物", videoHook: "铺下最后一块地垫，整个房间像被重新设计", imageOptimizationSuggestion: "主图强化黑白图案冲击和空间改造结果", suitablePlatform: "抖音 / 小红书")
        ]
    }

    static func creativeAsset(product: ProductInfo) -> CreativeAssetResult {
        CreativeAssetResult(
            id: UUID().uuidString,
            productId: product.id,
            conceptTitle: "一铺，房间立刻有了性格",
            coreContrast: "普通、冰冷、杂乱的地面，在地垫铺下后变成温暖、有记忆点、适合拍照的生活空间。",
            lifestylePositioning: "低成本空间改造道具，适合租房、办公室、卧室、直播间和内容电商场景。",
            imagePromptCN: "以当前地毯/地垫为主体，完整展示铺设在房间中的效果。自然光、黑白棋盘格/拼接纹理清晰可见，边缘和厚度有局部放大。",
            imagePromptEN: "Feature the current rug or floor mat as the main subject, fully laid out in a warm room. Natural light, clear checkerboard or modular texture, visible edges and thickness.",
            videoPromptCN: "5-10 秒竖屏 AI 视频广告。普通房间地面被一块块拼接地垫快速改造，暖光进入房间，一只可爱小猫慢慢走上地垫、打哈欠、趴下。地垫始终是主体。",
            videoPromptEN: "5-10 second vertical AI video ad. An ordinary room floor is transformed by modular rug tiles. Warm light enters, a cute cat walks onto the rug, yawns and lies down. The rug remains the main subject.",
            shotList: ["俯拍开场：普通地面和铺设前空间状态。", "手部铺设：地垫一块块拼接。", "低机位滑动：扫过纹理、厚度和边缘。", "氛围动作：小猫慢慢走上地垫。", "温馨收束：小猫打哈欠趴下，完整地垫入镜。"],
            negativePrompt: "商品主体不清晰、主体被遮挡、材质错误、比例错误、图案扭曲、文字乱码、水印、低清晰度、过度卡通、动物抢主体",
            directionalPrompts: mockDirectionalPrompts(),
            createdAt: Date()
        )
    }

    static func mockDirectionalPrompts() -> [DirectionalPromptAsset] {
        [
            DirectionalPromptAsset(
                directionId: "A",
                directionName: "方向 A：实用转化型",
                conceptTitle: "3 秒铺出一块完整地面",
                coreContrast: "零散普通地面与整洁满铺效果形成直接转化对比。",
                imagePromptCN: "实用转化型商品图 Prompt：以拼接地毯/地垫为主体，俯拍完整铺设效果，清楚展示边缘、厚度、免胶拼接方式和可扩展面积。",
                imagePromptEN: "Practical conversion product image prompt: feature the modular rug as the main subject, top-down full installation view, clear edges, thickness, adhesive-free joining and expandable coverage.",
                videoPromptCN: "5-10 秒竖屏实用转化视频。空地面开始，手部快速铺下一块块地垫，重点展示免胶、边缘贴合、厚度和自由组合。",
                videoPromptEN: "5-10 second vertical practical conversion video. Start with an empty floor, hands quickly place modular mat tiles, highlighting adhesive-free installation, tight edges, thickness and flexible combination.",
                shotList: ["俯拍空地面。", "第一块地垫贴合地面。", "多块地垫快速组合。", "边缘近景展示厚度。", "整块地面变整洁。"],
                negativePrompt: "商品主体不清晰、主体被遮挡、图案扭曲、边缘变形、文字乱码、水印"
            ),
            DirectionalPromptAsset(
                directionId: "B",
                directionName: "方向 B：生活方式型",
                conceptTitle: "一铺，房间像杂志里的家",
                coreContrast: "普通租房空间与温暖生活方式空间形成情绪反差。",
                imagePromptCN: "生活方式型商品图 Prompt：地垫铺设在奶油色卧室或客厅中，自然阳光、柔软织物纹理、黑白棋盘格清晰可见，一只小猫在边角轻轻趴着但不遮挡商品。",
                imagePromptEN: "Lifestyle product image prompt: the rug is installed in a cream-toned bedroom or living room, natural sunlight, soft textile texture, clear checkerboard pattern, a cat resting at one corner without covering the product.",
                videoPromptCN: "5-10 秒竖屏生活方式视频。普通房间铺上地垫后光线变暖，小猫慢慢走上地垫、低头闻一闻、打哈欠趴下。",
                videoPromptEN: "5-10 second vertical lifestyle video. After the rug is installed, the room becomes warmer; a cat walks onto it, sniffs, yawns and lies down.",
                shotList: ["普通房间开场。", "铺设完成切换。", "纹理近景。", "小猫走上地垫。", "温馨收束。"],
                negativePrompt: "动物遮挡主体、过度卡通、商品主体不清、图案错误、背景喧宾夺主"
            ),
            DirectionalPromptAsset(
                directionId: "C",
                directionName: "方向 C：强反差传播型",
                conceptTitle: "最后一块落下，房间换了气质",
                coreContrast: "杂乱无记忆点的地面与强图案空间形成强反差传播点。",
                imagePromptCN: "强反差传播型商品图 Prompt：采用铺设前后对比构图，一侧普通灰暗地面，一侧黑白棋盘格/拼接地垫满铺后的强视觉空间。",
                imagePromptEN: "High-contrast viral product image prompt: before-after split composition, one side plain dull floor, the other side bold checkerboard modular rug fully installed.",
                videoPromptCN: "5-10 秒竖屏强反差视频。杂乱普通地面开场，最后一块地垫落下瞬间，空间切换成强记忆点的黑白图案满铺效果。",
                videoPromptEN: "5-10 second vertical high-contrast video. Start with a messy plain floor; as the final mat tile lands, the space transforms into a bold checkerboard full-floor look.",
                shotList: ["杂乱地面开场。", "最后一块落下。", "图案扩展到全貌。", "低机位扫过边缘。", "黑白图案满铺定格。"],
                negativePrompt: "图案扭曲、空间比例错误、商品主体不清晰、低清晰度、水印"
            )
        ]
    }

    static func prompt(product: ProductInfo) -> AdPromptResult {
        let asset = creativeAsset(product: product)
        return AdPromptResult(id: asset.id, productId: product.id, conceptTitle: asset.conceptTitle, coreContrast: asset.coreContrast, visualStyle: asset.lifestylePositioning, promptCN: asset.videoPromptCN, promptEN: asset.videoPromptEN, shotList: asset.shotList, negativePrompt: asset.negativePrompt, createdAt: asset.createdAt)
    }
}
