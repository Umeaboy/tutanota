import m, { Children, Component, Vnode, VnodeDOM } from "mithril"
import { ConversationItem, ConversationViewModel, SubjectItem } from "./ConversationViewModel.js"
import { MailViewer } from "./MailViewer.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { theme } from "../../gui/theme.js"
import { Button, ButtonType } from "../../gui/base/Button.js"
import { assertNotNull } from "@tutao/tutanota-utils"
import { elementIdPart, getElementId } from "../../api/common/utils/EntityUtils.js"
import { MiniMailViewer } from "./MiniMailViewer.js"
import { mailViewerMargin } from "./MailViewerUtils.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { max } from "@tutao/tutanota-utils/dist/CollectionUtils.js"
import { px } from "../../gui/size.js"
import { Keys } from "../../api/common/TutanotaConstants.js"
import { keyManager, Shortcut } from "../../misc/KeyManager.js"

export interface ConversationViewerAttrs {
	viewModel: ConversationViewModel
}

const SCROLL_FACTOR = 4 / 5

export class ConversationViewer implements Component<ConversationViewerAttrs> {
	private primaryDom: HTMLElement | null = null
	private containerDom: HTMLElement | null = null
	private floatingSubjectDom: HTMLElement | null = null
	private didScroll = false
	private lastItems: readonly ConversationItem[] | null = null
	/** ids of the subject entries above the currently visible items. */
	private subjectsAboveViewport: Set<string> = new Set()

	private readonly shortcuts: Shortcut[] = [
		{
			key: Keys.PAGE_UP,
			exec: () => this.scrollUp(),
			help: "scrollUp_action",
		},
		{
			key: Keys.PAGE_DOWN,
			exec: () => this.scrollDown(),
			help: "scrollDown_action",
		},
		{
			key: Keys.HOME,
			exec: () => this.scrollToTop(),
			help: "scrollToTop_action",
		},
		{
			key: Keys.END,
			exec: () => this.scrollToBottom(),
			help: "scrollToBottom_action",
		},
	]

	oncreate() {
		keyManager.registerShortcuts(this.shortcuts)
	}

	onremove() {
		keyManager.unregisterShortcuts(this.shortcuts)
	}

	view(vnode: Vnode<ConversationViewerAttrs>): Children {
		const { viewModel } = vnode.attrs
		this.doScroll(viewModel)
		this.lastItems = viewModel.entries()

		return m(".fill-absolute.nav-bg", [
			m(
				".fill-absolute.scroll",
				{
					oncreate: (vnode) => {
						this.containerDom = vnode.dom as HTMLElement
					},
					onremove: () => {
						console.log("remove container")
					},
				},
				this.renderItems(viewModel),
				this.renderLoadingState(viewModel),
				m(".mt-l", {
					style: {
						// Having more room at the bottom allows the last email to be scrolled up more, which is nice
						height: "400px",
					},
				}),
			),
			this.renderFloatingHeader(),
		])
	}

	private renderItems(viewModel: ConversationViewModel): Children {
		return viewModel.entries().map((entry) => {
			switch (entry.type) {
				case "mail": {
					const mailViewModel = entry.viewModel
					const isPrimary = mailViewModel === viewModel.primaryViewModel()
					return this.renderViewer(mailViewModel, isPrimary)
				}
				case "subject": {
					return this.renderHeader(entry.subject, entry.id)
				}
				case "deleted": {
					return m(UnknownMailView, { key: getElementId(entry.entry) })
				}
			}
		})
	}

	private renderLoadingState(viewModel: ConversationViewModel): Children {
		return viewModel.isConnectionLost()
			? m(
					".center",
					m(Button, {
						type: ButtonType.Secondary,
						label: "retry_action",
						click: () => viewModel.retry(),
					}),
			  )
			: !viewModel.isFinished()
			? m(
					".font-weight-600.center.mt-l" + "." + mailViewerMargin(),
					{
						style: {
							color: theme.content_button,
						},
					},
					lang.get("loading_msg"),
			  )
			: null
	}

	private renderFloatingHeader(): Children {
		return m(
			".abs.nav-bg",
			{
				class: mailViewerMargin(),
				style: {
					top: 0,
					left: 0,
					right: 0,
					borderBottom: `1px solid ${theme.list_border}`,
					transition: `200ms ease-in-out`,
					// FIXME: why 40?
					transform: "translateY(-40px)",
				},
			},
			m(
				".b.subject.text-break.pt-s.pb-s.text-ellipsis",
				{
					oncreate: ({ dom }) => {
						this.floatingSubjectDom = dom as HTMLElement
					},
				},
				"",
			),
		)
	}

	private renderViewer(mailViewModel: MailViewerViewModel, isPrimary: boolean): Children {
		return m(
			".border-radius-big.mt-m",
			{
				class: mailViewerMargin(),
				key: elementIdPart(mailViewModel.mail.conversationEntry),
				oncreate: (vnode: VnodeDOM) => {
					if (isPrimary) {
						this.primaryDom = vnode.dom as HTMLElement
					}
				},
				style: {
					border: `1px solid ${theme.list_border}`,
					backgroundColor: theme.content_bg,
				},
			},
			// probably should trigger the load from somewhere here but currently we need to render mail viewer for that to happen
			!isPrimary && mailViewModel.isCollapsed()
				? m(MiniMailViewer, {
						viewModel: mailViewModel,
				  })
				: m(MailViewer, {
						viewModel: mailViewModel,
						isPrimary: isPrimary,
				  }),
		)
	}

	private renderHeader(normalizedSubject: string, id: string): Children {
		return m(ObservableSubject, {
			subject: normalizedSubject,
			id: id,
			cb: (visiblity) => this.onSubjectVisible(id, visiblity),
			key: "item-subject" + normalizedSubject,
		})
	}

	private onSubjectVisible(id: string, visibility: SubjectVisiblity) {
		switch (visibility) {
			case "visible":
				this.subjectsAboveViewport.delete(id)
				break
			case "above":
				this.subjectsAboveViewport.add(id)
				break
			case "below":
				this.subjectsAboveViewport.delete(id)
				break
		}
		if (this.floatingSubjectDom) {
			if (this.subjectsAboveViewport.size === 0) {
				// all subjects above us are visible, hide the sticky subject
				this.floatingSubjectDom.parentElement!.style.transform = `translateY(${px(-this.floatingSubjectDom.offsetHeight)})`
			} else {
				this.floatingSubjectDom.parentElement!.style.transform = ""
				this.floatingSubjectDom.innerText = this.subjectForFloatingHeader() ?? ""
			}
		}
	}

	private subjectForFloatingHeader(): string | null {
		const entries = this.lastItems
		if (!entries) return null
		// knowingly N^2
		const lastInvisibleSubject = max(Array.from(this.subjectsAboveViewport).map((id) => entries.findIndex((e) => e.type === "subject" && e.id === id)))
		if (lastInvisibleSubject == null) return null
		return (entries[lastInvisibleSubject] as SubjectItem).subject
	}

	private doScroll(viewModel: ConversationViewModel) {
		const primaryDom = this.primaryDom
		const containerDom = this.containerDom
		if (!this.didScroll && primaryDom && containerDom && viewModel.isFinished()) {
			let mailIndex = viewModel.getConversationIndexByMailId(viewModel.mail._id)

			if (mailIndex && mailIndex > 0) {
				// If the item before the primary mail is a subject use that as a scroll target
				const itemIndex = assertNotNull(viewModel.conversation)[mailIndex - 1].type === "subject" ? mailIndex - 1 : mailIndex
				this.didScroll = true
				requestAnimationFrame(() => {
					const top = (containerDom.childNodes[itemIndex] as HTMLElement).offsetTop
					// 46 for the floating header
					containerDom.scrollTo({ top: top - 46 })
				})
			}
		}
	}

	private scrollUp(): void {
		if (this.containerDom) {
			this.containerDom.scrollBy({ top: -this.containerDom.clientHeight * SCROLL_FACTOR, behavior: "smooth" })
		}
	}

	private scrollDown(): void {
		if (this.containerDom) {
			this.containerDom.scrollBy({ top: this.containerDom.clientHeight * SCROLL_FACTOR, behavior: "smooth" })
		}
	}

	private scrollToTop(): void {
		if (this.containerDom) {
			this.containerDom.scrollTo({ top: 0, behavior: "smooth" })
		}
	}

	private scrollToBottom(): void {
		if (this.containerDom) {
			this.containerDom?.scrollTo({ top: this.containerDom.scrollHeight - this.containerDom.offsetHeight, behavior: "smooth" })
		}
	}
}

type SubjectVisiblity = "above" | "below" | "visible"

interface ObservableSubjectAttrs {
	id: string
	cb: (visibility: SubjectVisiblity) => unknown
	subject: string
}

class ObservableSubject implements Component<ObservableSubjectAttrs> {
	lastAttrs: ObservableSubjectAttrs

	observer: IntersectionObserver | null = null

	constructor(vnode: Vnode<ObservableSubjectAttrs>) {
		this.lastAttrs = vnode.attrs
	}

	view(vnode: Vnode<ObservableSubjectAttrs>): Children {
		this.lastAttrs = vnode.attrs
		return m(
			".h5.subject.text-break.selectable.b.flex-grow.mt-m",
			{
				class: mailViewerMargin(),
				"aria-label": lang.get("subject_label") + ", " + (this.lastAttrs.subject || ""),
				style: { marginTop: "12px" },
				oncreate: (vnode) => {
					this.observer = new IntersectionObserver(
						(entries) => {
							const [entry] = entries
							const visibility = entry.isIntersecting
								? "visible"
								: entry.boundingClientRect.bottom < assertNotNull(entry.rootBounds).top
								? "above"
								: "below"
							this.lastAttrs.cb(visibility)
						},
						{ root: vnode.dom.parentElement },
					)
					this.observer.observe(vnode.dom)
				},
				onremove: (vnode) => {
					this.observer?.unobserve(vnode.dom)
				},
			},
			this.lastAttrs.subject,
		)
	}
}

class UnknownMailView implements Component {
	view() {
		return m(
			".center.pt-s.pb-s.font-weight-600.border-radius-big.mt-m",
			{
				class: mailViewerMargin(),
				style: {
					border: `1px solid ${theme.list_border}`,
					color: theme.content_button,
				},
			},
			// FIXME: placeholder for now
			"Unknown email",
		)
	}
}
