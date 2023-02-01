import m, { Children, Component, Vnode, VnodeDOM } from "mithril"
import { ConversationViewModel } from "./ConversationViewModel.js"
import { MailViewer } from "./MailViewer.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { theme } from "../../gui/theme.js"
import { Button, ButtonType } from "../../gui/base/Button.js"
import { assertNotNull, last, lastThrow, noOp } from "@tutao/tutanota-utils"
import { elementIdPart, getElementId, isSameId } from "../../api/common/utils/EntityUtils.js"
import { MiniMailViewer } from "./MiniMailViewer.js"
import { mailViewerMargin } from "./MailViewerUtils.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { setMax, setMin } from "@tutao/tutanota-utils/dist/CollectionUtils.js"
import { px } from "../../gui/size.js"

export interface ConversationViewerAttrs {
	viewModel: ConversationViewModel
}

export class ConversationViewer implements Component<ConversationViewerAttrs> {
	private primaryDom: HTMLElement | null = null
	private containerDom: Element | null = null
	private floatingSubjectDom: HTMLElement | null = null
	private didScroll: { mail: IdTuple } | null = null
	private orderedSubjects: string[] | null = null
	// this does not work and will not work
	// it is not enough to know is the subject is visible or not, we also need to know if it's above and below the viewport. Consider the scenario where
	// no subject is visible on the screen because we are in the middle of the long email. We need to show the subject above the current email but we don't
	// know which one it is because we are unaware of our current position.

	// We can listen to `scroll` events and detect the visible child on our own by comparing the coordinates perhaps?
	// Otherwise, we can try to attach intersectionObserver to every single item in the list, this will give us an idea of what the first visible item is
	// which tells us where we are in the list and what is the first *in*visible subject.
	// At any rate we shouldn't redraw on scroll.
	//
	// OR we could keep track of what's above/below by boundingClientRect from IntersectionObserver!
	private subjectsAboveViewport: Set<number> = new Set()

	view(vnode: Vnode<ConversationViewerAttrs>): Children {
		const itemsWithHeaders: Children[] = []
		const viewModel = vnode.attrs.viewModel
		if (this.didScroll && !isSameId(viewModel.mail._id, this.didScroll.mail)) {
			this.didScroll = null
		}
		this.doScroll(viewModel)

		if (viewModel.isConnectionLost()) {
			return m(
				".center",
				m(Button, {
					type: ButtonType.Secondary,
					label: "retry_action",
					// fixme
					click: () => noOp(),
				}),
			)
		}
		const entries = viewModel.entries()
		let lastSubject = null
		const subjects: string[] = []
		for (const entry of entries) {
			switch (entry.type) {
				case "mail": {
					const mailViewModel = entry.viewModel
					const normalizedSubject = this.normalizeSubject(mailViewModel.mail.subject)
					if (normalizedSubject !== lastSubject) {
						itemsWithHeaders.push(this.renderHeader(normalizedSubject, subjects.length))
						subjects.push(normalizedSubject)
						lastSubject = normalizedSubject
					}
					const isPrimary = mailViewModel === viewModel.primaryViewModel()

					itemsWithHeaders.push(this.renderViewer(mailViewModel, isPrimary, viewModel))
					break
				}
				case "deleted": {
					itemsWithHeaders.push(m(UnknownMailView, { key: getElementId(entry.entry) }))
					break
				}
			}
		}
		this.orderedSubjects = subjects
		itemsWithHeaders.push(m(".mt-l", { key: "footer" }))

		return m(".fill-absolute.nav-bg", [
			m(
				".fill-absolute.scroll",
				{
					oncreate: (vnode) => {
						console.log("create container")
						this.containerDom = vnode.dom
						// this.doScroll(viewModel)
					},
					onremove: () => {
						console.log("remove container")
					},
				},
				itemsWithHeaders,
			),
			lastSubject && this.renderFloatingHeader(),
		])
	}

	private renderFloatingHeader() {
		return m(
			".abs.nav-bg",
			{
				// class: mailViewerPadding(),
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

	private renderViewer(mailViewModel: MailViewerViewModel, isPrimary: boolean, viewModel: ConversationViewModel) {
		return m(
			".border-radius-big.overflow-hidden.mt-m",
			{
				class: mailViewerMargin(),
				key: elementIdPart(mailViewModel.mail.conversationEntry),
				oncreate: (vnode: VnodeDOM) => {
					if (isPrimary) {
						console.log("create primary")
						this.primaryDom = vnode.dom as HTMLElement
						// this.doScroll(viewModel)
					}
				},
				onremove: () => {
					if (isPrimary) {
						console.log("remove primary")
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

	private renderHeader(normalizedSubject: string, index: number): Children {
		return m(ObservableSubject, {
			subject: normalizedSubject,
			index,
			// FIXME
			cb: (index, visiblity) => this.onSubjectVisible(index, visiblity),
			key: "item-subject" + normalizedSubject,
		})
	}

	private onSubjectVisible(index: number, visibility: SubjectVisiblity) {
		switch (visibility) {
			case "visible":
				this.subjectsAboveViewport.delete(index)
				break
			case "above":
				this.subjectsAboveViewport.add(index)
				break
			case "below":
				this.subjectsAboveViewport.delete(index)
				break
		}
		if (this.floatingSubjectDom) {
			if (this.subjectsAboveViewport.size === 0) {
				// all subjects above us are visible, hide the sticky subject
				this.floatingSubjectDom.parentElement!.style.transform = `translateY(${px(-this.floatingSubjectDom.offsetHeight)})`
			} else {
				this.floatingSubjectDom.parentElement!.style.transform = ""
				this.floatingSubjectDom.innerText = this.subjectForStickyHeader() ?? ""
			}
		}
	}

	private subjectForStickyHeader(): string | null {
		console.log("subject for sticky", Array.from(this.subjectsAboveViewport))
		const lastInvisibleSubject = setMax(this.subjectsAboveViewport)
		if (this.orderedSubjects == null || lastInvisibleSubject == null) return null
		return this.orderedSubjects[lastInvisibleSubject]
	}

	private doScroll(viewModel: ConversationViewModel) {
		const primaryDom = this.primaryDom
		const containerDom = this.containerDom
		if (!this.didScroll && primaryDom && containerDom && viewModel.isFinished()) {
			// we say that we *did* scroll even if it would be too early (primaryDom is not attached?)
			// but why is it not attached if it's already next frame?

			this.didScroll = { mail: viewModel.mail._id }

			let scrollAmount = 0
			const mailIndex = viewModel.getConversationIndexByMailId(viewModel.mail._id)
			if (mailIndex && mailIndex > 0) {
				// 66 is the height of the MiniMailViewer, with padding
				scrollAmount = 66 * (mailIndex - 1)
			}
			requestAnimationFrame(() => {
				// note: we do not have to worry about scrolling too far, scrollTo will handle that
				containerDom.scrollTo({ top: scrollAmount })
			})
		}
	}

	private normalizeSubject(subject: string): string {
		const match = subject.match(/^(?:(?:re|fwd):?\s*)*(.*)$/i)
		return match ? match[1] : ""
	}
}

type SubjectVisiblity = "above" | "below" | "visible"

interface ObservableSubjectAttrs {
	index: number
	cb: (index: number, visibility: SubjectVisiblity) => unknown
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
							this.lastAttrs.cb(this.lastAttrs.index, visibility)
						},
						{ root: vnode.dom.parentElement },
					)
					this.observer.observe(vnode.dom)
				},
				onremove: (vnode) => {
					this.observer?.unobserve(vnode.dom)
					// this.lastAttrs.cb(this.lastAttrs.index, false)
				},
			},
			this.lastAttrs.subject,
		)
	}
}

class UnknownMailView implements Component {
	view() {
		return m(
			".center.pt.pb.font-weight-600.border-radius-big.mt-m",
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
